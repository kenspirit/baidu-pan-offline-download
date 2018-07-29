const fs = require('fs')
const axios = require('axios')
const cheerio = require('cheerio')
const iconv = require('iconv-lite')

// http://www.meijutt.com/content/meiju429.html
function extract(url) {
  return axios.get('http://www.meijutt.com/content/meiju429.html', { responseType: 'arraybuffer' })
    .then((response) => {
      const $ = cheerio.load(iconv.decode(response.data, 'gb2312'))
      const links = []
      $('.down_part_name a').each((idx, a) => {
        links.push($(a).attr('href'))
      })
      return links
    })
    .then((data) => {
      fs.writeFileSync('./links.txt', data.join('\n'))
      return data
    })
    .catch((err) => {
      console.log(err)
      return []
    })
}

module.exports = {
  extract
}
