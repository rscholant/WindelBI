import fs from 'fs';

const filename = `${process.cwd()}/windel-bi.json`;
const rawData = fs.readFileSync(filename);
const config = JSON.parse(rawData.toString());

export default config;
