/**
 * imgur:
 * helgame
 * hel@richardheuser.nl
 * passw0rd
 */

_ = lodash;

Meteor.startup(function () {
	//[
	//	{name: 'The Empire'},
	//	{name: 'Dwarfs'},
	//	{name: 'Bretonnia'},
	//	{name: 'Lizardmen'},
	//	{name: 'High Elves'},
	//	{name: 'Wood Elves'},
	//	{name: 'Dark Elves'},
	//	{name: 'Warriors of Chaos'},
	//	{name: 'Daemons of Chaos'},
	//	{name: 'Beastmen'},
	//	{name: 'Orcs & Goblins'},
	//	{name: 'Skaven'},
	//	{name: 'Vampire Counts'},
	//	{name: 'Tomb Kings'},
	//	{name: 'Ogre Kingdoms'},
	//	{name: 'Undead Legion'},
	//	{name: 'Legions of Chaos'},
	//	{name: 'Aestyrion'},
	//	{name: 'Host of the Phoenix King'},
	//	{name: 'Host of the Eternity King'}
	//]
});

Meteor.methods({
	clearMap: function () {
		regions.remove({});
		portals.remove({});
		battles.remove({});
	},
	depopulateMap: function () {
		regions.update({}, {$set: {owner: ''}}, {multi: true});
	},
	removeUnownedRegions: function () {
		regions.remove({owner: ''});
	},
	setAttack: function (region, attacker, defender, round) {
		battles.upsert({attacker: attacker, round: round}, {$set: {
			region: region,
			defender: defender,
			winner: ''
		}});
	},
	getRegionNames: function (count) {
		var result = Meteor.http.get('http://donjon.bin.sh/name/rpc.cgi?type=Location&n=' + count);
		return result && result.content && result.content.split('\n') || [];
	},
	clearBattles: function () {
		battles.remove({});
	},
	clearRounds: function () {
		rounds.remove({});
	},
	clearArmyLists: function () {
		armyLists.remove({});
	},
	setWinner: function (region, round, winner) {
		battles.update({region: region, round: round}, {$set: {winner: winner}}, {multi: true});
	},
	setArmyList: function (player, round, list) {
		armyLists.upsert({player: player, round: round}, {$set: {list: list}});
	},
	startGame: function () {
		Map.create();
		Map.populate();
		Round.next();
	}
});
