var fs = require('fs'),
    Faker = require('Faker'),
    data,
    limit = 2000;

var randomName = Faker.Name.findName(); // Rowan Nikolaus
var randomEmail = Faker.Internet.email(); // Kassandra.Haley@erich.biz
var randomCard = Faker.Helpers.createCard(); // random contact card containing many properties

data = { 'file': {} }

for (var i = limit; limit--;) {
    var uid = 'id'+limit;
    data['file'][uid] = {
        'id': uid,
        'name': Faker.Name.lastName() + ' ' + Faker.Address.city(),
        'type': Math.floor(10 * Math.random())
    }
}

data = JSON.stringify(data);

console.log(data);

fs.writeFile("fake-data.json", JSON.stringify(data), function(err) {
    if(err) {
        console.log(err);
    } else {
        console.log("The file was saved!");
    }
}); 
