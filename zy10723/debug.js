import fs from 'fs';
import csv from 'csv-parser';

const results = [];

fs.createReadStream('./samples/normal.csv')
  .pipe(csv())
  .on('headers', (headers) => {
    console.log('Headers:', headers);
    console.log('Headers length:', headers.length);
  })
  .on('data', (data) => {
    console.log('Row data:', JSON.stringify(data));
    console.log('退款单号 value:', JSON.stringify(data['退款单号']));
    results.push(data);
  })
  .on('end', () => {
    console.log('Total rows:', results.length);
  });
