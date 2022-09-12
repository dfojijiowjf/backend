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

module.exports = router;


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