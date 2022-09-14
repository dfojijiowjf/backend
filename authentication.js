const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const modules = require('./index.js')
const connection = modules.connection
const authenticateAccessToken = modules.authenticateAccessToken
const authenticateAdminToken = modules.authenticateAdminToken
const authenticateTeacherToken = modules.authenticateTeacherToken
const accessTokenDuration = modules.accessTokenDuration
const accessKey = modules.accessKey
const adminKey = modules.adminKey
const teacherKey = modules.teacherKey

router.post('/loading_admin',authenticateAdminToken,(req,res) => {
    const user = req.user.user
    
    const queryString = `SELECT username FROM admins WHERE username=${connection.escape(user)}`
        connection.query(queryString,(error,result,fields) => {
        if(error || result.length == 0) return res.json({msg:"failed"})        
        const data = {user:user,type:0}
        const access_token = jwt.sign(data,adminKey,{expiresIn:accessTokenDuration})
        return res.json({msg:"success",access_token:access_token,type:"admin"})
    })
})

router.post('/loading_student',authenticateAccessToken,(req,res) => {
    const user = req.user.user
//test
    const queryString = `SELECT student_id,name FROM students WHERE student_id=${connection.escape(user)};`
    connection.query(queryString,(error,result,fields) => {
        if(error || result.length == 0) return res.json({msg:"failed"})        
        const data = {user:user,type:1}
        const access_token = jwt.sign(data,accessKey,{expiresIn:accessTokenDuration})
        return res.json({msg:"success",access_token:access_token,type:"student",name:result[0].name})
    })
})

router.post('/loading_teacher',authenticateTeacherToken,(req,res) => {
    const user = req.user.user
    
    const queryString = `SELECT username FROM teachers WHERE username=${connection.escape(user)}`
        connection.query(queryString,(error,result,fields) => {
        if(error || result.length == 0) return res.json({msg:"failed"})        
        const data = {user:user,type:2}
        const access_token = jwt.sign(data,teacherKey,{expiresIn:accessTokenDuration})
        return res.json({msg:"success",access_token:access_token,type:"teacher"})
    })
})

router.post('/admin_login',(req,res) => {
    const password = req.body.password
    const username = req.body.username

    const queryString = `SELECT hashed_password FROM admins WHERE username=${connection.escape(username)};`
    connection.query(queryString,(error,results,fields) => {
        if(error || results.length == 0) return res.json({msg:"failed"})
        const hashed_password = results[0].hashed_password

        bcrypt.compare(password,hashed_password,(error,result) => {
            if(error) return res.json({msg:"failed"})
            if(result) {
                const data = {user:username,type:0}
                const access_token = jwt.sign(data,adminKey,{expiresIn:accessTokenDuration})
                return res.json({msg:"success",access_token:access_token})
            } else return res.json({msg:"failed"})
        })
    })
})

router.post('/student_login',(req,res) => {
    const password = req.body.password
    const student_id = req.body.student_id

    const queryString = `SELECT hashed_password FROM students WHERE student_id=${connection.escape(student_id)};`
    connection.query(queryString,(error,results,fields) => {
        if(error || results.length == 0) return res.json({msg:"failed"})        
        const hashed_password = results[0].hashed_password

        bcrypt.compare(password,hashed_password,(error,result) => {
            if(error) return res.json({msg:"failed"})
            if(result) {
                const data = {user:student_id,type:1}
                const access_token = jwt.sign(data,accessKey,{expiresIn:accessTokenDuration})
                return res.json({msg:"success",access_token:access_token})    
            } else return res.json({msg:"failed"})
        })
    })
})

router.post('/teacher_login',(req,res) => {
    const password = req.body.password
    const username = req.body.username

    const queryString = `SELECT hashed_password FROM teachers WHERE username=${connection.escape(username)};`
    connection.query(queryString,(error,results,fields) => {
        if(error || results.length == 0) return res.json({msg:"failed"})
        const hashed_password = results[0].hashed_password

        bcrypt.compare(password,hashed_password,(error,result) => {
            if(error) return res.json({msg:"failed"})
            if(result) {
                const data = {user:username,type:2}
                const access_token = jwt.sign(data,teacherKey,{expiresIn:accessTokenDuration})
                return res.json({msg:"success",access_token:access_token})
            } else return res.json({msg:"failed"})
        })
    })
})

module.exports = router;