import { JSONFilePreset } from "lowdb/node";
import axios from "axios";
import { createWriteStream } from "fs";
import path from "path";

const PUZZLE_URL = "https://www.thetimes.com/puzzles/printable";
const DOWNLOAD_PATH = "/home/ciiro/Documents/puzzles";
const dbPath = new URL("puzzleScraperDatabase.json", import.meta.url).pathname;

const defaultData = { puzzles: [] };
const db = await JSONFilePreset(dbPath, defaultData);

/**
 * Fetch a URL with optional response type.
 */
async function fetchPuzzles(url, resType = "text") {
	try {
		return await axios.get(url, {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
			},
			responseType: resType,
		});
	} catch (error) {
		console.error(`Error fetching ${url}:`, error);
		throw new Error(`Failed to fetch ${url}`);
	}
}

/**
 * Create file-safe date string.
 */
function getFileSafeDate(date) {
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = String(date.getFullYear()).slice(-2);
	return `${day}${month}${year}`;
}

/**
 * Download puzzle from URL and save as PDF.
 */
async function downloadPuzzle(url, name) {
	const response = await fetchPuzzles(url, "stream");

	if (response.status !== 200) {
		throw new Error(`Failed to download puzzle: Got status ${response.status}`);
	}

	const filePath = path.join(DOWNLOAD_PATH, `${name}.pdf`);
	return new Promise((resolve, reject) => {
		const stream = response.data.pipe(createWriteStream(filePath));
		stream.on("finish", resolve);
		stream.on("error", reject);
	});
}

// Main logic
const html = (await fetchPuzzles(PUZZLE_URL)).data;
const match = html.match(
	/window\.__TIMES_STATE__\s*=\s*({.*?});?\s*<\/script>/s
);

if (match) {
	try {
		const data = JSON.parse(match[1]);
		const puzzles = data.preloadedData.tpaData.page.body
			.map((a) => a.children[0])
			.filter((b) => b.name == "PRINTABLE_PUZZLE_1")
			.map((c) => c.children[0]);

		for (const element of puzzles) {
			const link = element.url;
			const htmlDate = element.headline;
			const date = new Date(htmlDate);
			const formattedDate = date.toLocaleDateString();
			const fileSafeDate = getFileSafeDate(date);

			if (db.data.puzzles.includes(fileSafeDate)) continue;

			try {
				await downloadPuzzle(link, fileSafeDate);
				await db.update(({ puzzles }) => puzzles.push(fileSafeDate));
				console.log(`Downloaded puzzle for ${formattedDate}`);
			} catch (e) {
				console.error(`Failed to download puzzle for ${formattedDate}:`, e);
			}
		}
	} catch (error) {
		console.error("Error parsing JSON data:", error);
	}
}
