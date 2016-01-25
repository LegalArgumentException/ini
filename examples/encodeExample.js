/**
* encodeExample.js : An example of how to use the encode function
*/
var ini = require('../ini.js');

// An example of an ini object
var data = {
  'number':  {count: 10},
  'string':  {drink: 'white russian'},
  'boolean': {isTrue: true},
  'nested boolean': {theDude: {abides: true, rugCount: 1}}
};

console.log("This is the data in object form :\n")
console.log(data);

// An example of encode with no options specified
var noOptions = ini.encode(data);
console.log(noOptions);

// Options created
var options = {
	section: "section",
	whitespace: "true"
}

console.log("\n-----------------\n");
console.log("This is the data with whitespace enabled and a section specified:\n")

// An example of encode with the options object specified
var allOptions = ini.encode(data, options);
console.log(allOptions);

// An example of encode with the options parameter as just a string
var stringOption = ini.encode(data, "justastring");

console.log("\n-----------------\n");
console.log("This is the data with options parameter as just a string:\n")
console.log(stringOption);