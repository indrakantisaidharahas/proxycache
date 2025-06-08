#!/usr/bin/env node

const { program } = require('commander');
const http = require('http');
const { MongoClient } = require('mongodb');

program
  .name("proxyserver")
  .version("1.0.0");

program
  .command('prserver')
  .description('Proxy to get data from destination URL using a port')
  .option('-p, --port <type>', 'origin port', '80')  
  .option('-s, --url <type>', 'destination URL')
  .option('-c, --clearcache', 'clear the cache') 
  .action(async (options) => {
    const port = parseInt(options.port);
    const url = options.url;
    const Clear = options.clearcache;

    const client = new MongoClient("mongodb://localhost:27017");

    try {
      await client.connect();
      const db = client.db("proxydb");
      const collection = db.collection("proxycollection");

      if (Clear) {
        await collection.deleteMany({});
        console.log(" Cache cleared");
        await client.close();
        return;
      }

      if (!url) {
        console.error(" Please provide a destination URL using --url");
        await client.close();
        return;
      }

      const found = await collection.findOne({ url });

      if (found) {
        console.log("Fetched from MongoDB cache:");
        console.log(found.Data);
      } else {
        const requestOptions = {
          hostname: url,
          port,
          path: '/',
          method: 'GET',
        };

        const req = http.request(requestOptions, (res) => {
          let data = '';

          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', async () => {
            try {
              await collection.insertOne({ url, Data: data });
              console.log(" Data fetched and stored:");
              console.log(data);
            } catch (e) {
              console.error(" Failed to insert into MongoDB:", e);
            } finally {
              await client.close();
            }
          });
        });

        req.on('error', async (err) => {
          console.error(` HTTP request error: ${err.message}`);
          await client.close();
        });

        req.end();
      }
    } catch (err) {
      console.error(" MongoDB Error:", err);
      await client.close();
    }
  });

program.parse(process.argv);
