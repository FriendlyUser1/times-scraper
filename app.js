import * as cheerio from "cheerio";

import { JSONFilePreset } from "lowdb/node";
import axios from "axios";
import { createWriteStream } from "fs";

const PUZZLE_URL = "https://www.thetimes.com/puzzles/printable";
const DOWNLOAD_PATH = "/home/ciiro/Documents/puzzles";

// prepare database
const dbPath = new URL("puzzleScraperDatabase.json", import.meta.url).pathname;

const defaultData = {
	puzzles: [],
};

const db = await JSONFilePreset(dbPath, defaultData);

// fetch the puzzles page
const html = (await axios.get(PUZZLE_URL)).data;

const $ = cheerio.load(html);

// for each puzzle link
$("table tr td a").each((index, element) => {
	const link = $(element).attr("href");

	const htmlDate = $(element).text().trim();
	const date = new Date(htmlDate);

	const formattedDate = date.toLocaleDateString();
	const fileSafeDate = getFileSafeDate(date);


	if (db.data.puzzles.includes(fileSafeDate)) return

	// download puzzle
	downloadPuzzle(link, fileSafeDate)
		.then(async () => {
			await db.update(({ puzzles }) => puzzles.push(fileSafeDate));
			console.log(`Downloaded puzzle for ${formattedDate}`);
		})
		.catch((e) => {
			throw new Error("Failed to download puzzle:", e);
		});
});

/**
 * create file-safe date string
 * @param {Date} date
 * @returns {string}
 */
function getFileSafeDate(date) {
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = String(date.getFullYear()).slice(-2);

	return `${day}${month}${year}`;
}

/**
 * download puzzle from URL
 * @param {string} url
 * @returns {Promise<void>}
 */
async function downloadPuzzle(url, name) {
	return new Promise(async (resolve, reject) => {
		const response = await axios.get(url, { responseType: "stream" });

		if (response.status === 200) {
			const stream = response.data.pipe(
				createWriteStream(`${DOWNLOAD_PATH}/${name}.pdf`)
			);
			stream.on("finish", resolve);
			stream.on("error", reject);
		} else {
			reject();
		}
	});
}
