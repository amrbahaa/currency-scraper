'use strict'

let xray = require('x-ray'),
	phantom = require('x-ray-phantom');

let bankScraper = function(config, CurrencyModel){
	let promises = [];
	let bankList = config.banks;
	let currencyMapper = config.currencyMappings;
	console.log(`scrapping started:: scrapping ${bankList.length} bank`);
	bankList.forEach(function(bank){
		let promise = new Promise((resolve, reject) => {
			console.log('scrapping bank: ' + bank.name);
			let bankScrap = xray().driver(phantom({webSecurity: false, weak: false}));

			bankScrap(bank.url, bank.scopeSelector, [{
				currency: bank.currencySelector,
				buy: bank.buySelector,
				sell: bank.sellSelector
			}])(function(error, currencies){
				if(error){
					reject(error);
				}
				else{

					// handle different mappings of same currency
					currencies.forEach(c => {
						let trimmedCurrency = c.currency.trim().replace(/\r?\n|\r/g, "");
						c.currency = currencyMapper[trimmedCurrency.toLowerCase()] || trimmedCurrency;
					});

					resolve({name: bank.name, rates: currencies});
				}
			});
		});

		promises.push(promise);
	});

	return Promise.all(promises).then(results => {
		console.log(`scrapping done:: scrapped ${results.length} bank`);
		// Map and order rates by bank, filter zeroed currency rates
		var rates = results.map(scrapResult => {
			return {
				bank: scrapResult.name,
				currencies: scrapResult.rates.filter(r => r.buy != 0 && r.sell != 0)
			};
		});

		var currency = new CurrencyModel({creationDate: new Date(), rates: rates});
		currency.save((error, currency) => {
			if(error){
				console.log(error);
			}else{
				console.log('latest currency rates saved into db');
			}
		});

		// Sets a new interval
		setTimeout(bankScraper, config.refreshInterval, config, CurrencyModel);
		return currency.toJSON();
	});
};

module.exports = bankScraper;