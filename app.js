require('dotenv').config();
const unirest = require("unirest");
const cheerio = require('cheerio');
const { MongoClient } = require('mongodb');

const proxies = [
    process.env.PROXY_1,
    process.env.PROXY_2,
    process.env.PROXY_3,
];

const url = "https://ozon.kz/category/kurtki-muzhskie-7545/";

const mongoUrl = 'mongodb://localhost:27017';
const dbName = 'ozon';  // Change this to your desired database name
const collectionName = 'scrapedData';  // Change this to your desired collection name

const saveToMongoDB = async (data) => {
    const client = new MongoClient(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        await collection.insertMany(data);
        console.log("Data successfully saved to MongoDB!");
    } catch (err) {
        console.log("Error saving data to MongoDB:", err.message);
    } finally {
        await client.close();
    }
};

const getData = async (proxyIndex = 0) => {
    try {
        if (proxyIndex >= proxies.length) {
            throw new Error("All proxies failed");
        }

        const response = await unirest
            .get(url)
            .proxy(proxies[proxyIndex]);

        if (response.status !== 200) {
            console.log(`Received status ${response.status} with proxy ${proxies[proxyIndex]}. Trying next proxy...`);
            return getData(proxyIndex + 1);  // Switch to the next proxy
        }

        const $ = cheerio.load(response.body);
        const divs = $('div');
        const scrapedData = [];

        for (const div of divs) {
            if (($(div).attr('id') || '').includes('state-searchResultsV2')) {
                const result = JSON.parse($(div).attr('data-state').toString());
                for (const el of result.items) {
                    const price1 = el?.mainState?.[0]?.atom?.priceV2?.price?.[0]?.text;
                    const price2 = el?.mainState?.[0]?.atom?.priceV2?.price?.[1]?.text;
                    const discount = el?.mainState?.[0]?.atom?.priceV2?.discount;
                    const link = el?.action?.link;
                    const imageLink = el?.tileImage?.items?.[0]?.image?.link;
                    const text = el?.mainState?.[2]?.atom?.textAtom?.text;

                    const item = {
                        price1,
                        price2,
                        discount,
                        link,
                        imageLink,
                        text,
                    };

                    scrapedData.push(item);
                }
            }
        }

        if (scrapedData.length > 0) {
            await saveToMongoDB(scrapedData);
        }

    } catch (e) {
        console.log(e.message);
    }
};

getData();
