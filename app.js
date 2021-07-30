const express = require('express')
const db = require('./mydb')

require('dotenv').config()
const IP = process.env.IP
const PORT = process.env.PORT

const app = express()

// A middle for checking if an api key is provided by the user
// If an api key is provided in the authorization header field then
// the api key is attached to the req object
const getApiKey = async (req, res, next) => {
  const apiKey = req.headers.authorization
  if (!apiKey) {
    res.status(403).json({
      status: 'fail',
      data: { apiKey: 'No api key in Authorization header' },
    })
  } else {
    req.apiKey = apiKey.replace('Bearer ', '').trim()
    next()
  }
}

// A middleware for checking if an api key is valid
// and is still active.
// if Ok the id of the user performing the request is attached to the req object.

const validateApiKey = async (req, res, next) => {
  try {
    const result = await db.getUserByApiKey(req.apiKey)
    // Check if user is active
    // check if null result then not found
    if (!result || !result.active) {
      res.status(403).json({ status: 'fail', data: { key: 'Invalid api key' } })
    } else {
      req.userId = result.id
      req.username = result.username
      next()
    }
  } catch (e) {
    res.status(500).json({ code: 'error', message: 'Internal server error' })
  }
}

app.use(express.urlencoded({ extended: false })) // to support URL-encoded bodies
app.use(express.json()) // to support JSON-encoded bodies

app.post('/register', async (req, res) => {
  const username = req.body.username
  const email = req.body.email
  try {
    const result = await db.register(username, email)
    res.json({
      status: 'success',
      data: { id: result.id, key: result.apiKey.key },
    })
  } catch (e) {
    if (e.status === 'fail') {
      res.status(400).json({ status: e.status, data: e.dataError })
    } else {
      // e.status === 50X
      res.status(500).json({ status: e.status, message: e.message })
    }
  }
})

app.use(getApiKey)
app.use(validateApiKey)

app.get('/user_by_id/:userId', async (req, res) => {
  let userId = req.params.userId
  if (isNaN(userId)) {
    res.json({ status: 'fail', data: { userId: `${userId} is not a number` } })
    return
  }
  userId = Number(userId)
  try {
    const result = await db.getUserById(userId)
    res.json({ status: 'success', data: { user: result } })
  } catch (e) {
    if (e.status === 'fail') {
      res.status(400).json({ status: e.status, data: e.dataError })
    } else {
      // e.status === 50X
      res.status(500).json({ status: e.status, message: e.message })
    }
  }
})

app.get('/myinfo', async (req, res) => {
  const userId = req.userId
  try {
    const result = await db.getUserById(userId)
    res.json({ status: 'success', data: { user: result } })
  } catch (e) {
    if (e.status === 'fail') {
      res.status(400).json({ status: e.status, data: e.dataError })
    } else {
      res.status(500).json({ status: e.status, message: e.message })
    }
  }
})

app.get('/user_by_username/:username', async (req, res) => {
  const username = req.params.username
  try {
    const result = await db.getUserByUsername(username)
    res.json({ status: 'success', data: { user: result } })
  } catch (e) {
    if (e.status === 'fail') {
      res.status(400).json({ status: e.status, data: e.dataError })
    } else {
      res.status(500).json({ status: e.status, message: e.message })
    }
  }
})

app.post('/send_message', async (req, res) => {
  const dst = req.body.dst // dst est une string
  const content = req.body.content
  try {
    const resultDstUser = await db.getUserByUsername(dst)
    if (!resultDstUser) {
      res.status(400).json({
        status: 'fail',
        data: { message_sent: false, message: `${dst} does not exist` },
      })
      return
    }
    if (resultDstUser.id === req.userId) {
      res.status(400).json({
        status: 'fail',
        data: {
          message_sent: false,
          message: `you can not send a message to yourself`,
        },
      })
      return
    }
    const result = await db.sendMessage(req.userId, resultDstUser.id, content)
    res.json({ status: 'success', data: { message_sent: true } })
  } catch (e) {
    if (e.status === 'fail') {
      res.status(400).json({ status: e.status, data: e.dataError })
    } else {
      res.status(500).json({ status: e.status, message: e.message })
    }
  }
})

app.get('/read_message/:username', async (req, res) => {
  const peerUsername = req.params.username
  if (peerUsername === req.username) {
    res.status(400).json({
      status: 'fail',
      data: {
        messages: `you can not have a conversation with yourself`,
      },
    })
    return
  }
  try {
    const peerUser = await db.getUserByUsername(peerUsername)
    if (!peerUser) {
      res.status(400).json({
        status: 'fail',
        data: { messages: `${peerUsername} does not exist` },
      })
      return
    }
    const result = await db.readMessage(req.userId, peerUser.id)
    const messages = result.map((message) => {
      if (message.srcId === req.userId) {
        message.src = req.username
        message.dst = peerUsername
      } else {
        message.src = peerUsername
        message.dst = req.username
      }
      delete message.srcId
      delete message.dstId
      return message
    })
    res.json({
      status: 'success',
      data: { messages: result },
    })
  } catch (e) {
    if (e.status === 'fail') {
      res.status(400).json({ status: e.status, data: e.dataError })
    } else {
      res.status(500).json({ status: e.status, message: e.message })
    }
  }
})

app.listen(PORT, IP, () => {
  console.log(`listening on ${IP}:${PORT}`)
})
