import * as fse from 'fs-extra'
import path from 'path'
import SftpClient from 'ssh2-sftp-client'
import NodeSsh from 'node-ssh'
import normalizePath from 'normalize-path'
import Model from '../../model'

export default class SftpDeploy extends Model {
  // connect: SftpClient
  constructor(appInstance: any) {
    super(appInstance)
    // this.connect = new SftpClient()
    console.log('instance sftp deploy')
  }

  async remoteDetect() {
    const result = {
      success: true,
      message: '',
    }

    const client = new SftpClient()

    const { setting } = this.db
    const connectConfig = {
      host: setting.server,
      port: Number(setting.port),
      username: setting.username,
      password: setting.password,
    }

    const testFilename = 'gridea.txt'
    const localTestFilePath = normalizePath(path.join(this.appDir, testFilename))
    const remoteTestFilePath = normalizePath(path.join(setting.remotePath, testFilename))

    try {
      await client.connect(connectConfig)
      await client.list('/')

      try {
        fse.writeFileSync(localTestFilePath, 'This is gridea test file. you can delete it.')

        await client.put(localTestFilePath, remoteTestFilePath)
        await client.delete(remoteTestFilePath)
      } catch (e) {
        console.error('SFTP Test Remote Error: ', e.message)
        result.success = false
        result.message = e.message
      } finally {
        if (fse.existsSync(localTestFilePath)) {
          fse.unlinkSync(localTestFilePath)
        }
      }
    } catch (e) {
      console.error('SFTP Test Remote Error: ', e.message)
      result.success = false
      result.message = e.message
    } finally {
      await client.end()
    }
    
    return result
  }

  async publish() {
    const result = {
      success: true,
      message: '',
    }

    const client = new NodeSsh()

    const { setting } = this.db
    const connectConfig = {
      host: setting.server,
      port: Number(setting.port),
      username: setting.username,
      password: setting.password,
      type: 'sftp',
    }

    const localPath = normalizePath(path.join(this.appDir, 'output'))
    const remotePath = normalizePath(path.join(setting.remotePath))

    try {
      await client.connect(connectConfig)
      try {
        await client.exec(`rm -rf ${remotePath}`)
        await client.mkdir(remotePath)
        const res = await client.putDirectory(localPath, remotePath, {
          recursive: true,
          concurrency: 10,
          validate: function (itemPath: string) {
            const baseName = path.basename(itemPath)
            return baseName.substr(0, 1) !== '.' // do not allow dot files
                   && baseName !== 'node_modules' // do not allow node_modules
          },
        })
      } catch (e) {
        console.error('SFTP Publish Error: ', e.message)
        result.success = false
        result.message = e.message
      }
    } catch (e) {
      console.error('SFTP Publish Error: ', e.message)
      result.success = false
      result.message = e.message
    } finally {
      await client.dispose()
    }

    return result
  }
}
