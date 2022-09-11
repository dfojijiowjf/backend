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

module.exports = router;