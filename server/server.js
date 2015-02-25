var armies = new Meteor.Collection('armies');
var regions = new Meteor.Collection('regions');
var rounds = new Meteor.Collection('rounds');
var players = new Meteor.Collection('players');
var armyLists = new Meteor.Collection('armyLists');
var battles = new Meteor.Collection('battles');

Meteor.methods({
	clearMap: function () {
		regions.remove({});
	},
	depopulateMap: function () {
		regions.update({}, {$set: {owner: ''}}, {multi: true});
	},
	removeUnownedRegions: function () {
		regions.remove({owner: ''});
	},
	setAttack: function (region, attacker, defender) {
		battles.upsert({attacker: attacker}, {$set: {
			region: region,
			defender: defender
		}});
	},
	getRegionNames: function (count) {
		var result = Meteor.http.get('http://donjon.bin.sh/name/rpc.cgi?type=Location&n=' + count);
		return result && result.content && result.content.split('\n') || [];
	}
});
