Router.configure({
	layoutTemplate: 'layout'
});
Router.route('/:page', function () {
	Session.set('currentPage', this.params.page);
	this.render(this.params.page);
});
Router.route('(.*)', function () {
	Session.set('currentPage', 'home');
	this.render('home');
});

Accounts.ui.config({
	passwordSignupFields: "USERNAME_ONLY"
});

var armies = new Meteor.Collection('armies');
var regions = new Meteor.Collection('regions');
var rounds = new Meteor.Collection('rounds');
var players = new Meteor.Collection('players');
var armyLists = new Meteor.Collection('armyLists');
var battles = new Meteor.Collection('battles');
var images = new Meteor.Collection('images');
var chatMessages = new Meteor.Collection('chatMessages');

var hexWidth = 60;
var hexHeight = 45;

var gameLength = 5;

var imgurClientId = '67ec3375f415b98';

var Player = {
	_player: undefined,
	
	_get: function () {
		return players.findOne({userId: Meteor.userId()}) || {};
		//if (!this._player) {
		//	if (!players.find().count()) {
		//		return {};
		//	}
		//	this._player = players.findOne({userId: Meteor.userId()});
		//}
		//return this._player || {};
	},
	create: function () {
		this.player = {userId: Meteor.userId(), army: 0};
		this.player._id = players.insert({userId: Meteor.userId(), army: 0});
	},
	getArmy: function () {
		return this._get().army;
	},
	setArmy: function (army) {
		this._update({army: army});
	},
	_update: function (fields) {
		players.update(this._get()._id, {$set: fields});
		this._player = undefined;
	},
	getArmyList: function (round) {
		return armyLists.findOne({player: this._get()._id, round: round || Round.number() || 1}) || {};
	},
	setArmyList: function (data) {
		var id = this.getArmyList()._id;
		if (id) {
			armyLists.update(id, {list: data});
		} else {
			armyLists.insert({player: this._get()._id, round: Round.number() || 1, list: data});
		}
	},
	setArmyName: function (name) {
		this._update({armyName: name});
	},
	getArmyName: function () {
		return this._get().armyName;
	},
	getRegions: function () {
		return regions.find({owner: this._get()._id});
	},
	getAttackableRegions: function () {
		var id = this._get()._id;
		var ownedRegions = this.getRegions().fetch();
		return _.uniq(_.reduce(ownedRegions, function (result, r) {
			return result.concat(_.pluck(_.filter(Map.getAdjacentRegions(r.x, r.y), function (r) {
				return r.owner !== id;
			}), '_id'));
		}, [], this));
	},
	getId: function () {
		return this._get()._id;
	},
	setAttack: function (regionId) {
		if (Round.number() && !Round.started() && this.canDeclareAttack()) {
			Session.set('attackRegionId', regionId);
			Meteor.call('setAttack', regionId, this._get()._id, regions.findOne({_id: regionId}).owner, Round.number());
		}
	},
	getAttack: function () {
		var battle = battles.findOne({round: Round.number(), attacker: this._get()._id});
		var dummy = Session.get('attackRegionId');
		return battle && battle.region;
		//return Session.get('attackRegionId') || this._get().attack;
	},
	getColor: function () {
		return this._get().color || '#ffffff';
	},
	setColor: function (color) {
		this._update({color: color});
	},
	setIcon: function (data) {
		var id = this._get().icon;
		if (id) {
			images.remove({_id: id});
		}
		id = images.insert({data: data});
		this._update({icon: id});
	},
	getIcon: function () {
		var id = this._get().icon;
		if (id) {
			var image = images.findOne({_id: id});
			return image && image.data;
		}
	},
	canDeclareAttack: function () {
		var playerStatus = Players(Player.getId()).status();
		return playerStatus === Players.STATUS.DECLARE || playerStatus === Players.STATUS.BATTLE;
	}
};

var Round = {
	pointIncrement: 500,
	
	_get: function () {
		return rounds.findOne({}, {sort: {number: -1}}) || {
			number: 0,
			started: false
		};
	},
	number: function () {
		return this._get().number;
	},
	started: function () {
		return this._get().started;
	},
	points: function () {
		return (this._get().number || 1) * this.pointIncrement;
	},
	next: function () {
		battles.find({round: this.number()}).forEach(function (battle) {
			var capital = players.findOne({capital: battle.region});
			if (capital && capital._id !== battle.winner) {
				// player lost capital
				Players(capital._id).setCapital(regions.findOne({owner: capital._id})._id);
			}
			regions.update({_id: battle.region}, {$set: {owner: battle.winner}}, {multi: true});
		});
		if (this.number() < gameLength) {
			rounds.insert({number: this.number() + 1, started: false});
		}
		Session.set('attackRegionId', undefined);
		Session.set('showArmyList', undefined);
	},
	start: function () {
		if (this.number() > 0 && !this.started()) {
			rounds.update({_id: this._get()._id}, {$set: {started: true}});
		}
	},
	reset: function () {
		Meteor.call('clearRounds');
		Meteor.call('clearArmyLists');
		Session.set('attackRegionId', undefined);
	},
	playersNotDone: function () {
		var gameStarted = !!this.number(),
				roundStarted = this.started();
		
		return _.filter(players.find().fetch(), function (player) {
			var id = player._id,
					p = Players(id);

			if (gameStarted) {
				if (roundStarted) {
					return p.status() < Players.STATUS.DONE;
				} else {
					return p.status() < Players.STATUS.BATTLE;
				}
			} else {
				return p.status() < Players.STATUS.DECLARE;
			}
		});
	}
};

var Map = {
	getArea: function (radius) {
		return _(_.range(1, radius)).reduce(function (m, v) {return m + v;}, 0) * 6 + 1;
	},
	clear: function () {
		Meteor.call('clearMap');
		Meteor.call('clearBattles');
	},
	create: function () {
		this.clear();
		
		var playerCount = players.find().count();
		var targetArea = playerCount * 5;
		var radius = 1;
		while (this.getArea(radius) < targetArea) {
			radius++;
		}
		var cols, rows = cols = radius * 2 - 1;
		_(_.range(0, rows)).each(function (y) {
			var rowLength = cols - Math.abs(y + 1 - radius);
			var xOffset = Math.floor((cols - rowLength) / 2);
			_(_.range(xOffset, xOffset + rowLength)).each(function (x) {
				this.insert(x, y);
			}, this);
		}, this);
	},
	insert: function (x, y) {
		regions.insert({x: x, y: y, owner: ''});
	},
	getDiameter: function () {
		return regions.findOne({}, {sort: {x: -1}}).x + 1;
	},
	getWidth: function () {
		return _.map(regions.find().fetch(), function (r) {
			return (1 - r.y % 2) / 2 + r.x + 1;
		}).sort().pop();
	},
	getHeight: function () {
		return regions.findOne({}, {sort: {y: -1}}).y + 1;
	},
	getXMin: function () {
		return _.map(regions.find().fetch(), function (r) {
			return (1 - r.y % 2) / 2 + r.x;
		}).sort().reverse().pop();
	},
	depopulate: function (callback) {
		Meteor.call('depopulateMap', [], callback);
	},
	populate: function () {
		this.depopulate(function () {
			//var regionsPerPlayer = Math.floor(regions.find().count() / players.find().count());
			var regionsPerPlayer = 5;
			var playerIndex = 0;
			players.find().forEach(function (player) {
				var id = player._id;
				id = id._str || id;
				_(_.range(0, regionsPerPlayer)).each(function (i) {
					var candidates = this.getUnownedRegions();
					if (i) {
						//candidates = _.filter(candidates, function (r) {
						//	return this.regionAdjacentTo(r.x, r.y, id);
						//}, this);
						candidates = _.filter(candidates, function (r) {
							return this.getAdjacentOwnedRegions(r.x, r.y, id).length >= (i > 3 ? Math.min(i, 2) : 1);
						}, this);
					} else if (playerIndex) {
						candidates = _.filter(candidates, function (r) {
							return this.getAdjacentPlayers(r.x, r.y).length >= Math.min(playerIndex, 2);
						}, this);
					}
					if (!candidates.length) {
						_.defer(this.populate.bind(this));
						throw new Error('No eligible regions :(');
					}
					var index = Math.round(Math.random() * (candidates.length - 1));
					var region = candidates[index];
					regions.update(region._id, {$set: {owner: id}});
					if (!i) {
						players.update({_id: id}, {$set: {capital: region._id}});
					}
				}, this);
				playerIndex++;
			}.bind(this));
			this.removeUnownedRegions();
			this.nameRegions();
		}.bind(this))
	},
	getRegionOwner: function (x, y) {
		return regions.findOne({x: x, y: y}).owner;
	},
	getRegion: function (x, y) {
		return regions.findOne({x: x, y: y});
	},
	regionAdjacentTo: function (x, y, owner) {
		var regions = this.getAdjacentRegions(x, y);
		return !!_.find(regions, function (r) {
			return r.owner === owner;
		});
	},
	getAdjacentOwnedRegions: function (x, y, owner) {
		var regions = this.getAdjacentRegions(x, y);
		return _.filter(regions, function (r) {
			return r.owner === owner;
		});
	},
	getAdjacentRegions: function (x, y) {
		var regions = [];
		var offset = (y % 2) * -1;
		regions.push([x - 1, y]);
		regions.push([x + 1, y]);
		
		regions.push([x + offset, y - 1]);
		regions.push([x + offset + 1, y - 1]);
		
		regions.push([x + offset, y + 1]);
		regions.push([x + offset + 1, y + 1]);
		
		return _.compact(_.map(regions, function (r) {
			return this.getRegion(r[0], r[1]);
		}, this));
	},
	getUnownedRegions: function () {
		return regions.find({owner: ''}).fetch();
	},
	removeUnownedRegions: function () {
		Meteor.call('removeUnownedRegions');
	},
	getAdjacentPlayers: function (x, y) {
		return _.compact(_.uniq(_.pluck(this.getAdjacentRegions(x, y), 'owner')));
	},
	nameRegions: function () {
		Meteor.call('getRegionNames', [regions.find().count()], function (err, names) {
			regions.find().forEach(function (region) {
				regions.update(region._id, {$set: {name: names.pop()}});
			});
		});
	}
};

var Players = function (id) {
	return {
		_get: function () {
			return players.findOne({_id: id});
		},
		status: function () {
			var player = this._get();
			if (!player) {
				return Players.STATUS.CREATE;
			}
			if (!player.army) {
				return Players.STATUS.SELECT;
			}
			if (!player.color) {
				return Players.STATUS.COLOR;
			}
			if (!player.icon) {
				return Players.STATUS.ICON;
			}
			var armyList = armyLists.findOne({player: id, round: Round.number() || 1});
			if (!armyList) {
				return Players.STATUS.SUBMIT;
			}
			var battle = battles.findOne({round: Round.number(), attacker: id});
			if (!battle) {
				return Players.STATUS.DECLARE;
			}
			var _battles = battles.find({winner: '', $or: [{attacker: id}, {defender: id}]}).count();
			if (_battles) {
				return Players.STATUS.BATTLE;
			}
			return Players.STATUS.DONE;
		},
		armyList: function () {
			return (armyLists.findOne({player: id, round: Round.number() || 1}) || {}).list || '';
		},
		armyName: function () {
			return this._get().armyName;
		},
		setCapital: function (region) {
			players.update({_id: id}, {$set: {capital: region}});
		}
	};
};

Players.STATUS = {
	CREATE: 0,
	SELECT: 1,
	COLOR: 2,
	ICON: 3,
	SUBMIT: 4,
	DECLARE: 5,
	BATTLE: 6,
	DONE: 7
};

var Icon = function (id) {
	var image = images.findOne({_id: id});
	return image && image.data || '';
};

Icon.fromUrl = function (url, callback) {
	var image = new Image();
	image.setAttribute('crossOrigin', 'anonymous');
	image.src = url;
	
	this.fromImage(image, callback);
};

Icon.fromImage = function (image, callback) {
	image.onload = function () {
		var canvas = $('<canvas>');
		canvas.attr('width', image.width);
		canvas.attr('height', image.height);
		canvas.get(0).getContext('2d').drawImage(image, 0, 0);
		callback(canvas.get(0).toDataURL());
	};
};

Template.menu.helpers({
	menuItems: function () {
		return [
			{name: 'home', title: 'Home'},
			{name: 'armies', title: 'Armies'},
			{name: 'game', title: 'Game'},
			{name: 'chat', title: 'Chat'}
		];
	},
	selected: function () {
		return this.name === Session.get('currentPage') ? '_selected' : '';
	}
});

Template.round.helpers({
	number: function () {
		return Round.number();
	},
	started: function () {
		return Round.started();
	},
	points: function () {
		return Round.points();
	},
	todo: function () {
		var player = Players(Player.getId()),
				status = player.status();
		if (!Round.number()) {
			switch (status) {
				case Players.STATUS.CREATE:
					return 'Create your army';
				case Players.STATUS.SELECT:
					return 'Select your army';
				case Players.STATUS.COLOR:
					return 'Select a color';
				case Players.STATUS.ICON:
					return 'Select an icon';
			}
		}
		if (!Round.started() && status === Players.STATUS.SUBMIT) {
			return 'Submit your army list';
		}
		if (Round.number() && status === Players.STATUS.DECLARE) {
			return 'Declare your attack';
		}
		if (Round.playersNotDone().length) {
			return 'You\'re done! Nothing to do but wait for the other players...';
		}
		return 'Everyone\'s done! Go ahead and click on "Start Round".';
	},
	done: function () {
		return !Round.playersNotDone().length;
	}
});

Template.round.events({
	'click #resetGame': function () {
		Map.clear();
		Round.reset();
	},
	'click #startGame': function () {
		Map.create();
		Map.populate();
		Round.next();
	},
	'click #nextRound': function () {
		Round.next();
	},
	'click #startRound': function () {
		Round.start();
	}
});

Template.armySettings.events({
	'click #createPlayer': function () {
		Player.create();
	},
	'change #uploadIcon > input': function () {
		var formData = new FormData($('form')[0]),
				progressHandlingFunction = function () {};
		
		$.ajax({
			url: 'https://api.imgur.com/3/image',
			type: 'POST',
			headers: {
				Authorization: 'Client-ID ' + imgurClientId,
				Accept: 'application/json'
			},
			xhr: function() {
				var xhr = $.ajaxSettings.xhr();
				if (xhr.upload) {
					xhr.upload.addEventListener('progress', progressHandlingFunction, false);
				}
				return xhr;
			},
			//beforeSend: beforeSendHandler,
			success: function (result) {
				//Icon.fromUrl(result.data.link, function (data) {
					var data = result.data.link;
					Player.setIcon(data);
				//});
			},
			//error: errorHandler,
			data: formData,
			cache: false,
			contentType: false,
			processData: false
		});
	}
});

Template.armySettings.helpers({
	player: function () {
		return Player.getId();
	},
	armies: function () {
		return armies.find();
	},
	selected: function () {
		return this.name === Player.getArmy() ? 'selected' : '';
	},
	armyName: function () {
		return Player.getArmyName();
	},
	color: function () {
		return Player.getColor();
	},
	icon: function () {
		return Player.getIcon();
	}
});

Template.armyList.helpers({
	roundPrep: function () {
		return !Round.started();
	},
	armyList: function () {
		var id = Session.get('showArmyList');
		if (id) {
			return Players(id).armyList();
		} else {
			return Player.getArmyList().list;
		}
	},
	armyOwner: function () {
		var id = Session.get('showArmyList');
		if (id && id !== Player.getId()) {
			return Players(id).armyName();
		} else {
			return 'Your';
		}
	}
});

Template.armyList.events({
	'input #armyList': function () {
		$('#submitArmyList').attr('disabled', false);
	},
	'click #submitArmyList': function () {
		Player.setArmyList($('#armyList').val());
		$('#submitArmyList').attr('disabled', true);
	}
});

Template.armies.helpers({
	gameStarted: function () {
		return !!Round.number();
	},
	army: function () {
		return Player.getArmy();
	}
});

var prevent = function (e) {
	e.stopPropagation();
	e.preventDefault();
};

Template.armies.events({
	'change #army': function (event) {
		Player.setArmy(event.target.value);
	},
	'change #armyName': function (event) {
		Player.setArmyName(event.target.value);
	},
	'change #colorPicker': function (event) {
		Player.setColor(event.target.value);
	},
	'dragenter #dropzone': prevent,
	'dragexit #dropzone': prevent,
	'dragover #dropzone': prevent,
	'drop #dropzone': function (e) {
		prevent(e);
		if (e.dataTransfer.files.length) {
			var file = e.dataTransfer.files[0],
					reader = new FileReader();

			reader.onload = function () {
				var data = reader.result,
						parsedData = /^data:([^;]*);base64,(.*)$/.exec(data),
						mimeType = parsedData[1]
				;

				if (mimeType.match(/^image\/\w+$/)) {
					Player.setIcon(data);
				}
			};

			reader.readAsDataURL(file);
		} else {
			var data = e.dataTransfer.getData('text/html');
			if (data) {
				Icon.fromImage($(data).get(1), function (data) {
					Player.setIcon(data);
				});
			}
		}
	}
});

Template.game.events({
	'click #nextRound': function () {
		rounds.insert({});
	}
});

Template.game.helpers({
	roundStarted: function () {
		return Round.started();
	},
	gameStarted: function () {
		return !!Round.number();
	}
});

Template.map.helpers({
	width: function () {
		return (Map.getWidth() - Map.getXMin()) * hexWidth;
	},
	height: function () {
		return Map.getHeight() * hexHeight + hexHeight / 3;
	},
	region: function () {
		return regions.find();
	},
	points: function () {
		var points = [];
		//var y = this.y;
		//var x = this.x * hexWidth;
		var step = hexWidth / 4;
		//var isEvenRow = !(y % 2);
		//y *= hexHeight;
		//if (isEvenRow) {
		//	x += 2 * step;
		//}

		points.push([0, step]);
		points.push([2 * step, 0]);
		points.push([4 * step, step]);
		points.push([4 * step, 3 * step]);
		points.push([2 * step, 4 * step]);
		points.push([0, 3 * step]);

		return _(points).map(function (p) {return p.join(',');}).join(' ');
	},
	color: function () {
		var player = players.findOne({_id: this.owner});
		return player && player.color || '#fff';
	},
	anchorX: function () {
		var y = this.y;
		var x = (this.x - Map.getXMin()) * hexWidth;
		var isEvenRow = !(y % 2);
		if (isEvenRow) {
			x += hexWidth / 2;
		}
		return x;
	},
	anchorY: function () {
		var y = this.y;
		y *= hexHeight;
		return y/* + hexHeight / 1.5*/;
	},
	id: function () {
		return this._id;
	},
	owned: function () {
		return this.owner === Player.getId() ? 1 : 0;
	},
	attacking: function () {
		return Player.getAttack() === this._id ? 1 : 0;
	},
	attackable: function () {
		return _.contains(Player.getAttackableRegions(), this._id);
	},
	capital: function () {
		var player = players.findOne({capital: this._id});
		if (player) {
			var icon = images.findOne({_id: player.icon});
		}
		return player && icon && icon.data;
	},
	attackRegion: function () {
		return (regions.findOne({_id: Player.getAttack()}) || {}).name;
	},
	defenderName: function () {
		var player = (regions.findOne({_id: Player.getAttack()}) || {}).owner;
		return (players.findOne({_id: player}) || {}).armyName;
	},
	defenderArmy: function () {
		var player = (regions.findOne({_id: Player.getAttack()}) || {}).owner;
		return (players.findOne({_id: player}) || {}).army;
	},
	defenderColor: function () {
		var player = (regions.findOne({_id: Player.getAttack()}) || {}).owner;
		return (players.findOne({_id: player}) || {}).color;
	}
});

Template.map.rendered = function () {
	var playerStatus = Players(Player.getId()).status();
	var canDeclareAttack = playerStatus === Players.STATUS.DECLARE || playerStatus === Players.STATUS.BATTLE;
	if (Round.number() && !Round.started() && canDeclareAttack) {
		_.each(Player.getAttackableRegions(), function (id) {
			$('#map .region[data-id="' + id + '"')
					.attr('data-attackable', 1)
					.click(function () {
						Player.setAttack(id);
					})
			;
		});
	}
};

Template.battles.events({
	'click #iWon': function () {
		Meteor.call('setWinner', this.regionId, Round.number(), Player.getId());
	},
	'click #didntWin': function () {
		Meteor.call('setWinner', this.regionId, Round.number(), '');
	}
});

Template.battles.helpers({
	battles: function () {
		//var _battles = battles.aggregate([{$group: {_id: '$region', defender: {$first: '$defender'}, attackers: {$addToSet: '$attacker'}}}]).fetch();
		var _battles = {};
		var getPlayer = function (id, role, winner) {
			return _.extend(players.findOne({_id: id}) || {}, {
				role: role,
				winner: winner,
				score: regions.find({owner: id}).count()
			});
		};
		//var i = 0;
					
		battles.find({round: Round.number()}).forEach(function (b) {
			if (!_battles[b.region]) {
				_battles[b.region] = {
					//number: ++i,
					regionId: b.region,
					region: (regions.findOne({_id: b.region}) || {}).name,
					players: [getPlayer(b.defender, 'defender', b.winner && b.winner === b.defender)],
					winner: b.winner
				};
			}
			_battles[b.region].players.unshift(getPlayer(b.attacker, 'attacker', b.winner && b.winner === b.attacker));
			var ps = _battles[b.region].players;
			var lowest = _.min(_.pluck(ps, 'score'));
			var highest = _.max(_.pluck(ps, 'score'));
			_battles[b.region].players = _.map(ps, function (p) {
				p.underdog = (p.score === lowest && p.score < highest);
				return p;
			});
		});
		
		return _.toArray(_battles);
	},
	userName: function () {
		return Meteor.users.findOne({_id: this.userId}).username;
	},
	winnerIsMe: function () {
		return this.winner === Player.getId();
	},
	iCanWin: function () {
		return !this.winner && _.contains(_.pluck(this.players, '_id'), Player.getId());
	},
	me: function () {
		return this._id === Player.getId() ? 'me' : '';
	},
	isWinner: function () {
		return this.winner === false ? 'loser' : this.winner ? 'winner' : '';
	},
	planLink: function () {
		var title = encodeURIComponent('Battle of ' + this.region);
		var desc = encodeURIComponent(_.reduce(this.players, function (m, p) {
			return m + p.role + ': ' + p.armyName + ' (' + p.army + ') - ' + Meteor.users.findOne({_id: p.userId}).username + (p.underdog ? ' [Underdog Support]' : '') + '\n';
		}, ''));
		var player = encodeURIComponent(Meteor.users.findOne({_id: Meteor.userId()}).username);
		var location = encodeURIComponent('Joost\'s place');
		return 'http://doodle.com/create?type=date&title=' + title + '&location=' + location + '&description=' + desc + '&name=' + player;
	}
});

Template.allArmies.helpers({
	players: function () {
		return players.find();
	},
	icon: function () {
		return (images.findOne({_id: this.icon}) || {}).data;
	},
	me: function () {
		return this._id === Player.getId() ? 'me' : '';
	},
	regions: function () {
		return regions.find({owner: this._id}).count();
	},
	started: function () {
		return Round.started();
	}
});

Template.allArmies.events({
	'click #showList': function () {
		Session.set('showArmyList', this._id);
	}
});

Template.waiting.helpers({
	playersNotDone: function () {
		return Round.playersNotDone();
	},
	userName: function () {
		return Meteor.userId() === this.userId ? 'You' : Meteor.users.findOne({_id: this.userId}).username;
	},
	icon: function () {
		return Icon(this.icon);
	},
	regionCount: function () {
		return regions.find({owner: this._id}).count();
	}
});

Template.warning.helpers({
	show: function () {
		return !Cookie.get('warningSeen');
	}
});

Template.warning.events({
	'click #closeWarning': function () {
		Cookie.set('warningSeen', true);
	}
});

Template.chat.helpers({
	chatMessages: function () {
		var messages = chatMessages.find();
		messages.observe({
			added: function () {
				var $chatbox = $('#chatbox');
				$chatbox.stop().animate({scrollTop: $chatbox.prop('scrollHeight')}, 500);
			}
		});
		return messages;
	},
	userName: function () {
		return Meteor.users.findOne({_id: this.userId}).username;
	},
	time: function () {
		return this.time && moment(this.time).fromNow() || '';
		//return this.time && this.time.toLocaleTimeString && this.time.toLocaleTimeString() || '';
	}
});

Template.chat.events({
	'keypress #chatinput': function (e) {
		var message = $(e.target).text().trim();
		if (e.keyCode === 13 && message) {
			chatMessages.insert({userId: Meteor.userId(), message: message, time: new Date()});
			$(e.target).text('');
		}
	}
});

Template.chat.rendered = function () {
	var $chatbox = $('#chatbox');
	var $chatinput = $('#chatinput');
	var margins = $chatbox.outerHeight(true) - $chatbox.height();
	var resizeChatbox = function () {
		$chatbox.height($(window).height() - $chatbox.offset().top - margins - $chatinput.outerHeight(true));
	}
	$(window)
			.on('resize', resizeChatbox)
			.on('scroll', resizeChatbox)
	;
	resizeChatbox();
	
	$chatbox.stop().animate({scrollTop: $chatbox.prop('scrollHeight')}, 0);
	$chatinput.focus();
};
