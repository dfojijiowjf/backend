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