import axios, { AxiosResponse } from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import _ from 'lodash'
import { VideoInfo } from './VideoInfo'

const config = require('../config.json')

let localConfig: any
try {
	localConfig = require('../localConfig.json')
} catch (err) {

}

if (localConfig) {
	_.merge(config, localConfig)
}
if (!(config.webhookID as string).match(/^\d+$/)) {
	console.log(`Webhook invalid! : config.webhookID`)
	process.exit(-1)
}

const scraper = axios.create()

let discordOptions = {
	baseURL: 'https://discordapp.com/api/',
	headers: {
		'Content-Type': 'application/json;charset=UTF-8',
	},
}

if (config.proxy) {
	_.merge(discordOptions, {
		httpsAgent: new HttpsProxyAgent(`http://${config.proxy.host}:${config.proxy.port}`),
		proxy: false
	})
}

const discordAPI = axios.create(discordOptions)

const mid = config.mid
const atRoles: string[] = config.atRoles
const atUsers: string[] = config.atUsers

let latestVideoID: string;
let counter = 0;
async function task() {
	try {
		let vid = await getLatestVideo(mid)
		counter++
		if (latestVideoID === undefined) {
			latestVideoID = vid.bvid
			console.log(`[${dateString()}] Latest video: ${bVideoUrlFrom(latestVideoID!)}`)
			return
		} else if (vid.bvid == latestVideoID) {
			if (counter > 10) {
				console.log(`[${dateString()}] No new video found.`)
				counter = 0
			}
			return
		}

		latestVideoID = vid.bvid;
		counter = 0
		let url = bVideoUrlFrom(latestVideoID)

		console.log(`[${dateString()}] Video found! : ${url}`)

		let atString = [
			atRoles.map((item) => { return `<@&${item}>` }),
			atUsers.map((item) => { return `<@${item}>` })
		].flat().join(' ')

		let text = `${atString}\n${url}`

		sendToDiscord(text)

	} catch (err) {
		console.log(err.message)
	}
}

async function onNewVideoPublished() {

}

async function getLatestVideo(id: string | number): Promise<VideoInfo> {
	let response = await scraper.get('https://api.bilibili.com/x/space/arc/search', {
		params: {
			mid: id,
			pn: 1,
			ps: 1
		}
	})

	if (response.status.toString()[0] != '2') {
		throw { message: "Request unsucceed.", response }
	}

	let video: VideoInfo = response.data.data.list.vlist[0];
	return video;
}

const sendToDiscord = _.throttle(async (text: string): Promise<AxiosResponse> => {
	let message = {
		content: text,
		allowed_mentions: {
			parse: ['roles', 'users']
		}
	}

	let response = await discordAPI.post(`/webhooks/${config.webhookID}/${config.webhookToken}`, message);

	if (response.status.toString()[0] != '2') {
		throw { message: "Request unsucceed.", response }
	}

	return response
}, 5000, { leading: true })

function bVideoUrlFrom(bvid: string) {
	return `https://www.bilibili.com/video/${bvid}`
}

function dateString(): string {
	return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })
}

console.log(`[${dateString()}] Starting.`)
task()
setInterval(task, 60000)
console.log(`[${dateString()}] Loop started.`)