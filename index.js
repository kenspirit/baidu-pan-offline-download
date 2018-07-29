const _ = require('lodash')
const fs = require('fs')
const axios = require('axios')
const Promise = require('bluebird')
const crypto = require('crypto')
const Tesseract = require('tesseract.js')
const querystring = require('querystring')
const Random = require('random-js')
const { extract } = require('./lib/linkextractor')

const engine = Random.engines.mt19937().autoSeed()



const COOKIE = 'BAIDUID=8A42F4F615E27EE8D44C30CEB5CD38CC:FG=1; PSTM=1508295277; BIDUPSID=57509AD9A65A2BA0EA8551EF8F6D90D7; FP_UID=12fa005dadee06189a948c9d6875ef5a; BAIDU_SSP_lcr=http://www.javashuo.com/content/p-3270679.html; pgv_pvi=604020736; pgv_si=s9971979264; BDRCVFR[feWj1Vr5u3D]=I67x6TjHwwYf0; PSINO=7; PANWEB=1; panlogin_animate_showed=1; pan_login_way=1; H_PS_PSSID=; MCITY=-140%3A; cflag=13%3A3; Hm_lvt_7a3960b6f067eb0085b7f96ff5e660b0=1532520417,1532520592; BDUSS=h2WVh6RTBzT0loaWRoenNFSnNqb0xGU01CT2d2UDl6am5xdWpSdi1IT3ZhSUZiQVFBQUFBJCQAAAAAAAAAAAEAAABy0NQzVGhpbmtJbkNyb3dkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAK~bWVuv21lbUH; SCRC=239da1c38b1597f6cc7b86d6662d8d0f; STOKEN=5f4c4d82c55b7cb6869c5901349909cc312ac2dd547fbb8553604749342bc991; Hm_lpvt_7a3960b6f067eb0085b7f96ff5e660b0=1532694229; PANPSC=5177320811635711361%3A4jL3HSqVSCKqiuw%2BxHdMA8GVd6iFGVY%2BsdZ2aZxQI00CUx%2FuO2KPjBOAD5r1J1nbDCxL07jmVAYrLiGIa9cM2%2BP88rSCQXQh38HquAl4lpSVkUhRbhEJ0i0dSq0vC6NZqesNq6FZ8Q776jyG3uDkPYshZ7OchQK1KQDQpg%2B6XCV%2BSJWX9%2F9F%2FHiRThv12%2F1vLvo7HDxacDA%3D'
const bdstoken = '2028cf30463b53c9014ca81ea3dafe53'
const dir = '/Episodes/Modern Family/S1/'
const errLinksFile = './errLinks.txt'

Promise.all([
  readFile('./links.txt'),
  readFile(errLinksFile)
])
.spread((links, errLinks) => {
  // Remove empty lines
  _.remove(links, l => !l)
  _.remove(errLinks, l => !l)

  if (errLinks.length > 0) {
    return postData(errLinks, dir, postDataGenerator)
  } else {
    return writeFile(errLinksFile, '')
      .then(() => {
        return postData(links, dir, postDataGenerator)
      })
  }
})

function postDataGenerator(link, path, vcode, input) {
  const data = {
    method: 'add_task',
    app_id: 250528,
    source_url: link,
    save_path: path,
    type: 3
  }
  if (vcode) {
    data.vcode = vcode
  }
  if (input) {
    data.input = input
  }
  return data
}

async function writeFile(fileName, content) {
  return new Promise((resolve, reject) => {
    fs.writeFile(fileName, content, (err) => {
      if (err) {
        return reject(err)
      }

      return resolve(true)
    })
  })
}

async function readFile(fileName) {
  return new Promise((resolve, reject) => {
    fs.readFile(fileName, (err, data) => {
      if (err) {
        return reject(err)
      }

      return resolve(String(data).split('\n'))
    })
  })
}

async function getImage(url) {
  const fileName = `${Random.hex()(engine, 8)}.jpeg`
  return axios.get(url, {
      responseType: 'arraybuffer'
    })
    .then((res) => {
      return new Promise((resolve, reject) => {
        fs.writeFile(`./vcode/${fileName}`,
            new Buffer(res.data, 'binary'),
            (err) => {
              if (err) {
                return reject(err)
              }

              return resolve(fileName)
            })
      })
    })
}

const errLinks = []
async function postData(links, path, genFn) {
  if (links.length === 0) {
    if (errLinks.length > 0) {
      return writeFile(errLinksFile, errLinks.join('\n'))
    }
    return Promise.resolve(true)
  }

  let link = links.splice(0, 1)[0]
  if (link === '') {
    if (errLinks.length > 0) {
      return writeFile(errLinksFile, errLinks.join('\n'))
    }
    return Promise.resolve(true)
  }

  let vcode, input
  if (link.indexOf('err:') === 0) {
    const components = link.substring(4).split(',')

    if (components.length !== 4) {
      console.log('Invalid error link ' + link)
      return postData(links, path, genFn)
    }

    input = components[1]
    vcode = components[2]
    link = components[3]
  }

  const data = genFn(link, path, vcode, input)
  console.log(data)
  const logid = Buffer.from(crypto.randomBytes(32)).toString('base64')

  return axios.post(`https://pan.baidu.com/rest/2.0/services/cloud_dl?channel=chunlei&web=1&app_id=250528&bdstoken=${bdstoken}&logid=${logid}&clienttype=0`,
    querystring.stringify(data),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Cookie: COOKIE
      }
    })
    .then((result) => {
      console.log(result.data)
      return Promise.delay(30 * 1000)
        .then(() => {
          return postData(links, path, genFn)
        })
    })
    .catch((err) => {
      if (err.response && err.response.data.error_code === -19) {
        // vcode is needed
        const { img, vcode } = err.response.data
        return getImage(img)
          .then((fileName) => {
            errLinks.push(`err:${fileName},INPUT,${vcode},${link}`)
            return postData(links, path, genFn)
          })
      } else {
        console.log(err)
        links.push(link)
        console.log(`Remained: ${links}`)
      }
    })
}
