const crypto = require('crypto')
const { PrismaClient, Prisma } = require('@prisma/client')
const prisma = new PrismaClient()

const customizeError = (e) => {
  // A query error
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    e.status = 'fail'
    e.dataError = {}
    switch (e.code) {
      case 'P2002':
        e.dataError[e.meta.target[0]] = `${e.meta.target[0]} already exists`
        break
      default:
        e.dataError[e.meta.target[0]] = e.message
    }
  } else {
    e.status = 'error'
  }
  throw e
}

exports.register = async (username, email) => {
  const apiKey = crypto.randomUUID()
  try {
    const result = await prisma.user.create({
      data: {
        username: username,
        email: email,
        apiKey: {
          create: {
            key: apiKey,
          },
        },
      },
    })

    return await prisma.user.findUnique({
      where: {
        id: result.id,
      },
      select: {
        id: true,
        apiKey: {
          select: {
            key: true,
          },
        },
      },
    })
  } catch (e) {
    customizeError(e)
    throw e
  }
}

exports.getUserByApiKey = async (apiKey) => {
  try {
    /* 1ere alternative: la meilleure */
    const result = await prisma.user.findFirst({
      where: {
        apiKey: {
          key: {
            contains: apiKey,
          },
        },
      },
    })
    /* 2eme alternative: result est différent
    const result =  await prisma.apiKey.findUnique({
      where: {
        key: apiKey,
      },
      select: {
        user: true,
      },
    })*/
    return result
  } catch (e) {
    customizeError(e)
    throw e
  }
}

exports.getUserById = async (userId) => {
  try {
    return await prisma.user.findUnique({
      where: {
        id: userId,
      },
    })
  } catch (e) {
    customizeError(e)
    throw e
  }
}

exports.getUserByUsername = async (username) => {
  try {
    return await prisma.user.findUnique({
      where: {
        username: username,
      },
    })
  } catch (e) {
    customizeError(e)
    throw e
  }
}

exports.sendMessage = async (srcId, dstId, content) => {
  try {
    return await prisma.message.create({
      data: {
        srcId: srcId,
        dstId: dstId,
        content: content,
      },
    })
  } catch (e) {
    customizeError(e)
    throw e
  }
}

exports.readMessage = async (user1Id, user2Id) => {
  try {
    return await prisma.message.findMany({
      // par exemple: SELECT * FROM message WHERE src_id = 3 AND dst_id = 1 OR src_id = 1 AND dst_id = 3 ORDER BY created_at ASC;
      where: {
        OR: [
          {
            AND: [
              {
                srcId: user1Id,
              },
              {
                dstId: user2Id,
              },
            ],
          },
          {
            AND: [
              {
                srcId: user2Id,
              },
              {
                dstId: user1Id,
              },
            ],
          },
        ],
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        srcId: true,
        dstId: true,
        content: true,
        createdAt: true,
      },
    })
  } catch (e) {
    customizeError(e)
    throw e
  }
}
