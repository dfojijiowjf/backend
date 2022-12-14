const express = require('express');
const router = express.Router();
const modules = require('./index.js')
const connection = modules.connection
const authenticateAccessToken = modules.authenticateAccessToken
const authenticateAdminToken = modules.authenticateAdminToken
const authenticateTeacherToken = modules.authenticateTeacherToken
const { v4: uuidv4 } = require('uuid')

router.post('/setupSubject', authenticateAdminToken, (req, res) => {
    const subjectName = req.body.subjectName
    const perGroup = parseInt(req.body.perGroup)
    const options = JSON.stringify(req.body.options)

    const subjectId = uuidv4()
    const queryString = `INSERT INTO subjects VALUES(${connection.escape(subjectId)},${connection.escape(subjectName)},${connection.escape(options)},${perGroup});`
    connection.query(queryString, (error, results, fields) => {
        if (error) return res.json({ msg: "failed" })
        return res.json({ msg: "success" })
    })
})

//Teacher get
router.get('/teacher_info', authenticateTeacherToken, (req, res) => {
    const queryString = `SELECT * FROM subjects;`
    connection.query(queryString, (error, results, fields) => {
        if (error) return res.json({ msg: "failed" })
        const subjects = results

        return res.json({ msg: "success", subjects: subjects })
    })
})

//Student details post
router.post('/prefs', authenticateAccessToken, (req, res) => {
    const studentId = req.user.user
    const subjectId = req.body.subjectId
    const background = req.body.background
    const options = JSON.stringify(req.body.options)

    const queryString = `SELECT name FROM students WHERE student_id=${connection.escape(studentId)};`
    connection.query(queryString, (error, results, fields) => {
        console.log(error)
        if (error || results.length == 0) return res.json({ msg: "failed" })
        const studentName = results[0].name

        const queryString = `SELECT subjectName FROM subjects WHERE subjectId=${connection.escape(subjectId)};`
        connection.query(queryString, (error, results, fields) => {
            console.log(error)
            if (error || results.length == 0) return res.json({ msg: "failed" })
            const subjectName = results[0].subjectName

            const queryString = `INSERT INTO student_prefs VALUES(${connection.escape(studentId)},${connection.escape(subjectId)},${connection.escape(background)},${connection.escape(options)},${connection.escape(subjectName)},${connection.escape(studentName)});`
            connection.query(queryString, (error, results, fields) => {
                console.log(error)
                if (error) return res.json({ msg: "failed" })
                return res.json({ msg: "success", subjectName: subjectName })
            })
        })
    })
})

router.get('/randomAssign/:subjectId', authenticateTeacherToken, (req, res) => {
    const subjectId = req.params.subjectId

    const queryString = `SELECT groupId,name,numStudents,studentsPerGroup 
    FROM student_groups INNER JOIN subjects ON student_groups.subjectId=subjects.subjectId
    WHERE subjects.subjectId=${connection.escape(subjectId)};`
    connection.query(queryString, (error, results, fields) => {
        console.log(error)
        if (error) return res.json({ msg: "failed" })
        if (results.length == 0) return res.json({ msg: "empty" })
        const groups = results

        const queryString = `SELECT student_prefs.studentId,background,topic,name,groupName FROM student_prefs
            LEFT JOIN group_member ON ((student_prefs.studentId=group_member.studentId) AND (student_prefs.subjectId=group_member.subjectId))
            WHERE student_prefs.subjectId=${connection.escape(subjectId)};
        `
        connection.query(queryString, (error, results, fields) => {
            console.log(error)
            if (error) return res.json({ msg: "failed" })
            const students = results

            const maxStudents = groups[0].studentsPerGroup
            var groupIdToNumStudents = {}
            var groupIdToName = {}
            var groupIds = []
            groups.map(group => {
                if (group.numStudents < maxStudents) {
                    groupIds.push(group.groupId)
                    groupIdToNumStudents[group.groupId] = group.numStudents
                    groupIdToName[group.groupId] = group.name
                }
            })

            //Need to check theres enough groups/spots for the students
            //(numGroups * numMaxStudents) < students.length then not enough spots
            if (groups.length * maxStudents < students.length) return res.json({ msg: 'not-enough-groups' })

            var studentsToAddString = ''

            for (var i = 0; i < groupIds.length; i++) {
                const id = groupIds[i]
                var numStudentsInGroup = groupIdToNumStudents[id]

                //for already assigned students dont move them
                //when you assign a student need to remove them from the pool of students
                for (var x = 0; x < students.length; x++) {
                    const student = students[x]
                    if (student.groupName != "") continue

                    studentsToAddString += `(${connection.escape(id)},${connection.escape(student.studentId)},${connection.escape(subjectId)},${connection.escape(groupIdToName[id])}),`
                    numStudentsInGroup += 1
                    if (numStudentsInGroup >= maxStudents) break
                }
                groupIdToName[id] = numStudentsInGroup
            }

            studentsToAddString = studentsToAddString.length == 0 ? null : studentsToAddString.substring(0, studentsToAddString.length - 1)

            const queryString = studentsToAddString == null ? 'SELECT NULL;' : `INSERT INTO student_groups VALUES${studentsToAddString};`
            connection.query(queryString, (error, results, fields) => {
                console.log(error)
                if (error) return res.json({ msg: "failed" })

                updateGroups(groupIdToNumStudents, (error) => {
                    if (error.length != 0) return res.json({ msg: "error" })

                    return res.json({ msg: "success" })
                })
            })
        })
    })
})

router.get('/automaticAssign/:subjectId', authenticateTeacherToken, (req, res) => {
    const subjectId = req.params.subjectId

    const queryString = `SELECT studentsPerGroup FROM subjects WHERE subjectId=${connection.escape(subjectId)};`
    connection.query(queryString, (error, results, fields) => {
        if (error) return res.json({ msg: "failed" })
        const studentsPerGroup = results[0].studentsPerGroup

        const queryString = `
        SELECT student_prefs.studentId,background,topic,name,groupName FROM student_prefs
            LEFT JOIN group_member ON ((student_prefs.studentId=group_member.studentId) AND (student_prefs.subjectId=group_member.subjectId))
            WHERE student_prefs.subjectId=${connection.escape(subjectId)};
        `
        connection.query(queryString, (error, results, fields) => {
            if (error) return res.json({ msg: "failed" })
            var poolOfStudents = results
            var groups = []
            var notFilledGroups = []

            //Loop thru student, each time u find another student with same pref add to group
            while(poolOfStudents.length != 0) {
            // for (var i = 0; i < poolOfStudents.length; i++) {
                const student = poolOfStudents[0]
                const topic = student.topic
                var matchedStudentsId = [student.studentId]
                var matchedStudents = [student]

                poolOfStudents = poolOfStudents.filter(s => {
                    if(s.studentId == student.studentId) {
                        return false
                    } else {
                        return true
                    } 
                })
                
                //For students with no similarities then gotta send them to the extra group
                for (var x=0; x < poolOfStudents.length; x++) {
                    const student2 = poolOfStudents[x]
                    const topic2 = student2.topic
                    
                    
                    if (topic == topic2) {
                        matchedStudents.push(student2) 
                        matchedStudentsId.push(student2.studentId)      
                    }

                    if(matchedStudents.length == studentsPerGroup) {
                        break
                    }
                }
                //Filter from pool for members in matchedStudents
                poolOfStudents = poolOfStudents.filter(s => {
                    if(matchedStudentsId.includes(s.studentId)) {
                        return false
                    } else {
                        return true
                    } 
                })
                
                if(matchedStudents.length == studentsPerGroup) {
                    groups.push(matchedStudents)
                } else {
                    notFilledGroups.push(matchedStudents)
                }
            }
            
            //Loop thru each notfilled group and add it with another group to try and fill it up
            //Double for loop, start at element 1, if i+(i+1) <= maxStudents add together and then make that one gruop and keep going
                //If not then that is a group
            //Sort so the non filled groups with the lowest amount of members are first to form as many grousps

            var sortedNotFilledGroups = notFilledGroups.sort((a,b) => a.length - b.length)
            var t = [...sortedNotFilledGroups[0]]

            for(var i=1;i<sortedNotFilledGroups.length;i++) {
                const c = sortedNotFilledGroups[i]
                const x = t.length + c.length > studentsPerGroup

                if(x == true) {
                    groups.push(t)
                    t = [...c]
                } else {
                    t = [...t,...c]
                }

                if(i == sortedNotFilledGroups.length - 1) {                    
                    groups.push(t)
                }
            }

            var groupString = ""
            var memberString = ""

            groups.map((group,idx) => {
                const groupId = uuidv4()
                const groupName = `Group ${idx+1}`
                groupString += `("${groupId}",${connection.escape(subjectId)},"${groupName}",${group.length}),`

                for(var i=0;i<group.length;i++) {
                    const member = group[i]

                    memberString += `(${connection.escape(groupId)},${connection.escape(member.studentId)},${connection.escape(subjectId)},${connection.escape(groupName)}),`
                }
            })
            memberString = memberString.substring(0,memberString.length-1)
            groupString = groupString.substring(0,groupString.length-1)

            const queryString = `INSERT INTO student_groups VALUES${groupString};`
            connection.query(queryString, (error, results, fields) => {
                if (error) return res.json({ msg: "failed" })

               
                const queryString = `INSERT INTO group_member VALUES${memberString};`
                connection.query(queryString, (error, results, fields) => {
                    if (error) return res.json({ msg: "failed" })

                    return res.json({ msg: "success" })
                })
            })
        })
    })
})


router.get('/subject_info/:subjectId', authenticateTeacherToken, (req, res) => {
    //Get all students enrolled into the subject, any groups for that subject etc
    const subjectId = req.params.subjectId

    const queryString = ` SELECT student_prefs.studentId,background,options,name,groupName FROM student_prefs
    LEFT JOIN group_member ON ((student_prefs.studentId=group_member.studentId) AND (student_prefs.subjectId=group_member.subjectId))
    WHERE student_prefs.subjectId=${connection.escape(subjectId)};
    `
    // const queryString = `SELECT studentId,background,options,name FROM student_prefs WHERE subjectId=${connection.escape(subjectId)};`
    connection.query(queryString, (error, results, fields) => {
        console.log(error)
        if (error) return res.json({ msg: "failed" })
        const students = results

        const queryString = `SELECT groupId,name,numStudents FROM student_groups WHERE subjectId=${connection.escape(subjectId)};`
        connection.query(queryString, (error, results, fields) => {
            if (error) return res.json({ msg: "failed" })
            const groups = results

            const queryString = `SELECT student_groups.groupId,students.name,students.student_id FROM student_groups
            INNER JOIN group_member ON student_groups.groupId=group_member.groupId
            INNER JOIN students ON students.student_id=group_member.studentId
            WHERE student_groups.subjectId=${connection.escape(subjectId)};`
            connection.query(queryString, (error, results, fields) => {
                if (error) return res.json({ msg: "failed" })
                const members = {}
                results.map(member => {
                    const val = members[member.groupId]
                    const studentVal = {name:member.name,id:member.student_id}
                    
                    if(val == null) {
                        members[member.groupId] = [studentVal]
                    } else {
                        const newMems = [studentVal,...val]
                        members[member.groupId] = newMems
                    }
                })
                return res.json({ msg: "success", groups: groups, students: students,members:members })
            })
        })
    })
})

router.get('/student_info', authenticateAccessToken, (req, res) => {
    const studentId = req.user.user

    const queryString = `SELECT subjectName,subjectId FROM student_prefs WHERE studentId=${connection.escape(studentId)};`
    connection.query(queryString, (error, results, fields) => {
        if (error) return res.json({ msg: "failed" })
        const enrolled_subjects = results
        var enrolledString = ""

        results.map(e => {
            enrolledString += `${connection.escape(e.subjectId)},`
        })
        enrolledString = enrolledString.substring(0, enrolledString.length - 1)

        const queryString = results.length == 0 ? "SELECT subjectName,subjectId,options FROM subjects;" : `SELECT subjectName,subjectId,options FROM subjects WHERE subjectId NOT IN(${enrolledString});`
        connection.query(queryString, (error, results, fields) => {
            if (error) return res.json({ msg: "failed" })
            if (enrolled_subjects.length == 0) return res.json({ msg: "success", enrolled_subjects: [], subjects: results, groups: [], subject_prefs: [] })
            const subjects = results


            var subjectString = ""
            results.map(sub => {
                subjectString += `${connection.escape(sub.subjectId)},`
            })
            subjectString = results.length == 0 ? "" : subjectString.substring(0, subjectString.length - 1)

            const queryString = `SELECT groupId FROM group_member WHERE studentId=${connection.escape(studentId)} AND subjectId IN(${subjectString})`
            connection.query(queryString, (error, results, fields) => {
                if (error) return res.json({ msg: "failed" })

                var groupString = ""
                results.map(group => {
                    groupString += `${connection.escape(group.groupId)},`
                })
                groupString = groupString.substring(0, groupString.length - 1)

                const queryString = `SELECT name,subjectId FROM group_member
                        INNER JOIN students ON group_member.studentId=students.student_id
                        WHERE group_member.groupId IN(${connection.escape(groupString)});`
                connection.query(queryString, (error, results, fields) => {
                    if (error) return res.json({ msg: "failed" })
                    const groups = results

                    return res.json({ msg: "success", enrolled_subjects: enrolled_subjects, groups: groups, subjects: subjects })
                })
            })
        })
    })
})

router.post('/manualAssign', authenticateTeacherToken, (req, res) => {
    const groupId = req.body.groupId
    const studentId = req.body.studentId
    const subjectId = req.body.subjectId
    const groupName = req.body.groupName

    const queryString = `INSERT INTO group_member VALUES(${connection.escape(groupId)},${connection.escape(studentId)},${connection.escape(subjectId)},${connection.escape(groupName)});`
    connection.query(queryString, (error, results, fields) => {
        if (error) return res.json({ msg: "failed" })

        const queryString = `UPDATE student_groups SET numStudents=numStudents+1 WHERE groupId=${connection.escape(groupId)};`
        connection.query(queryString, (error, results, fields) => {
            if (error) return res.json({ msg: "failed" })
            return res.json({ msg: "success" })
        })
    })
})

router.get('/admin_info', authenticateAdminToken, (req, res) => {
    const queryString = `SELECT * FROM subjects;`
    connection.query(queryString, (error, results, fields) => {
        if (error) return res.json({ msg: "failed" })
        const subjects = results
        return res.json({ msg: "success", subjects: subjects })
    })
})


module.exports = router;
