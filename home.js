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

module.exports = router;