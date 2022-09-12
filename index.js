const express = require('express')
const app = express()
const morgan = require('morgan')
const cors = require('cors')
const mysql = require('mysql2')
const jwt = require('jsonwebtoken')

const accessKey = '699366e19f4aed0711d5b0bea1fbbc97fd47a052c34a6f6a55058bd6760dc055b387ec4ac48885d302b8aecbad97b06e1eecb3cb824384ac81d7794efd080663'
const adminKey = 'eaa00a17958152d5040d6dd27aa91e85619421027291d20cde696bd881fdfdecccca6644d08e6bfe20610c40bed3d487985a4d26a4ebd308e9e35717c5f923d7'
const teacherKey = 'db34d5362eb7494880379ca06454dce5db2c4f1f44495a0f22e19afa9350cb9e668d2abf40264a00be0e1f7ddc276bb5c086954aabf39e6f9b9c01341e76e2b7'
const accessTokenDuration = `${60 * 3}m`

const connection = mysql.createConnection({
	host:'127.0.0.1',
	user:'root',
	password:'root',
	database:'uts'
})

//Student Token

const authenticateAdminToken = (req,res,next) => {
	const authHeader = req.headers['authorization']
	const token = authHeader && authHeader.split(' ')[1]
	if(token == null) return res.json({"msg":"fail3"})

	jwt.verify(token,adminKey,(error,result) => {
		console.log(error)
		if(error && error.message == 'jwt expired') return res.json({"msg":"expired"})
		if(error) return res.json({"msg":"fail4"})
		req.user = result
		next()		
	})
}

//Teacher Token
const authenticateTeacherToken = (req,res,next) => {
	const authHeader = req.headers['authorization']
	const token = authHeader && authHeader.split(' ')[1]
	if(token == null) return res.json({"msg":"fail3"})

	jwt.verify(token,teacherKey,(error,result) => {
		console.log(error)
		if(error && error.message == 'jwt expired') return res.json({"msg":"expired"})
		if(error) return res.json({"msg":"fail4"})
		req.user = result
		next()		
	})
}


//Exports
exports.connection = connection
exports.authenticateAccessToken = authenticateAccessToken
exports.authenticateAdminToken = authenticateAdminToken
exports.authenticateTeacherToken = authenticateTeacherToken
exports.accessKey = accessKey
exports.teacherKey = teacherKey
exports.adminKey = adminKey
exports.accessTokenDuration = accessTokenDuration

app.use(cors())
app.use(morgan('short'))
app.use(express.json())

const home = require('./home')
const authentication = require('./authentication')

app.use('/home',home)
app.use('/authentication',authentication)

app.listen(3001,() => {
    console.log("Listening on port 3001 for UTS")
})