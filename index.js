import fs from 'fs'
import axios from "axios"
import cheerio from 'cheerio'
import tldts from 'tldts'

import {CONTENT_TYPES, INVALID_FILENAME_CHARS} from './constants.js'

const saveSourcePage = (url, response) => {
    const filename = url.replace(INVALID_FILENAME_CHARS, '');

     fs.writeFileSync(`./Pages/${filename}`, response.data, err => {
        if (err) {
            console.error(err)
            return
        }
        console.log(`${filename } page HTML saved`)
    })
}

const isUrlValid = (response, allowedContentTypes) => {
    const urlContentType = response.headers['content-type'].split(';')[0]
    return allowedContentTypes.includes(urlContentType)
}

const isSameDomain = (fullLink, hrefAttr) => {
    const domain = tldts.getDomain(fullLink)
    const subDomain = tldts.getSubdomain(fullLink)

    const currDomain = tldts.getDomain(hrefAttr)
    const currSubDomain = tldts.getSubdomain(hrefAttr)

    if(currSubDomain === subDomain && currDomain === domain){
        // console.log(hrefAttr + ' is the same domain')
        return true
    }else{
        // console.log(hrefAttr + ' is NOT the same domain')
        return false
    }
}

const calculateRatio = (link, links) => {
    const sameDomain = []

    for (const currLink of links){
        if(isSameDomain(link, currLink)){
            sameDomain.push(currLink)
        }
    }
    return sameDomain.length / links.length
}

const crawlLink = async (link) =>{
    if(!linkMap[link]){
        const response = await axios.get(link);
        if(!isUrlValid(response, CONTENT_TYPES.TEXT_HTML)){
            console.log(`Loris web crawler doesn't accept ${response.headers['content-type']} content types`);
            return null
        }else {
            // console.log(`Content type is valid`);
            saveSourcePage(link, response);

            const html = response.data;
            const $ = cheerio.load(html);
            const linkObjects = $('a');

            if (linkObjects.length > 0) {
                const links = [];
                linkObjects.each((index, element) => {
                    const hrefAttr = $(element).attr('href')
                    if (hrefAttr) {
                        links.push(new URL(hrefAttr, link).href);
                    }
                });

                const ratio = calculateRatio(link, links)

                linkMap[link] = {link:link, ratio: ratio, children:links}
                return {link:link, ratio: ratio, children:links}
            }
        }
    }else {
        return linkMap[link]
    }
}

console.log("Loris web crawler started running");
const url = process.argv[2];
const maxDepth = process.argv[3];
console.log(`Crawling URL: ${url} in max depth of: ${maxDepth}`)

const linkMap = {}

const outputFileName = 'output.tsv'
const headers = ['url','depth','ratio']

fs.writeFileSync(`./${outputFileName}`, headers.join("\t"), err => {
    if (err) {
        console.error(err)
        return
    }
    console.log("Headers added to output file")
})


const crawledLink = await crawlLink(url);
let currDepth = 1;

let content = `\t${crawledLink.link}\t${currDepth}\t${crawledLink.ratio}`

await fs.appendFile(outputFileName, content,err => {
    if (err) {
        console.error(err)
        return
    }
    console.log(`Depth ${currDepth}: Output file updated with ${crawledLink.link} data`)}
)

currDepth = currDepth + 1
console.log(`Depth ${currDepth}: ${crawledLink.children.length} children links found`)


let children = crawledLink.children

for (let i = currDepth; i <= maxDepth ; i++) {
    let newChildren = []

    for (const currLink of children){
        const currCrawledLink = await crawlLink(currLink)
        if (currCrawledLink){
            content = `\t${currCrawledLink.link}\t${currDepth}\t${currCrawledLink.ratio}`
            await fs.appendFile(outputFileName, content,err => {
                if (err) {
                    console.error(err)
                    return
                }
                console.log(`Depth ${currDepth}: Output file updated with ${currCrawledLink.link} data`)}
            )
            newChildren.push(...currCrawledLink.children)
        }
    }
    children = newChildren
    currDepth = currDepth + 1
    console.log(`Depth ${currDepth}: ${children.length} children links found`)
    children = newChildren
}