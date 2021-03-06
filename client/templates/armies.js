var imgurClientId = '67ec3375f415b98';
var prevent = function (e) {
	e.stopPropagation();
	e.preventDefault();
};

Template.armies.helpers({
	gameStarted: function () {
		return !!Round.number();
	},
	army: function () {
		return Player().armyBook();
	}
});

Template.armySettings.events({
	'change #army': function (event) {
		Player().armyBook(event.target.value);
	},
	'change #armyName': function (event) {
		Player().armyName(event.target.value);
	},
	'change #colorPicker': function (event) {
		Player().color(event.target.value);
	},
	'dragenter #dropzone': prevent,
	'dragexit #dropzone': prevent,
	'dragover #dropzone': prevent,
	'drop #dropzone': function (e) {
		prevent(e);
		var player = Player();
		var setIcon = player.icon.bind(player);
		var trans = $('input:radio[name="transparency"]:checked').val();
		if (e.dataTransfer.files.length) {
			var file = e.dataTransfer.files[0],
					reader = new FileReader();

			reader.onload = function () {
				var data = reader.result,
						parsedData = /^data:([^;]*);base64,(.*)$/.exec(data),
						mimeType = parsedData[1]
				;
				
				if (mimeType.match(/^image\/\w+$/)) {
					Icon.fromUrl(data, trans, setIcon);
				}
			};

			reader.readAsDataURL(file);
		} else {
			var data = e.dataTransfer.getData('text/html');
			if (data) {
				Icon.fromImage($(data).get(1), trans, setIcon);
			}
		}
	},
	'click #createPlayer': function () {
		Player().create();
	},
	'change #uploadIcon > input': function () {
		var formData = new FormData($('form')[0]),
				progressHandlingFunction = function () {};
		var trans = $('input:radio[name="transparency"]:checked').val();

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
				var player = Player();
				Icon.fromUrl(result.data.link, trans, player.icon.bind(player));
			},
			//error: errorHandler,
			data: formData,
			cache: false,
			contentType: false,
			processData: false
		});
	},
	'change input:radio[name="transparency"]': function () {
	}
});

Template.armySettings.helpers({
	player: function () {
		return Player().id();
	},
	armies: function () {
		return armies.find();
	},
	selected: function () {
		return this.name === Player().armyBook() ? 'selected' : '';
	},
	armyName: function () {
		return Player().armyName();
	},
	color: function () {
		return Player().color();
	},
	icon: function () {
		return Player().icon();
	},
	roundZero: function () {
		return !Round.number();
	}
});

Template.armyList.helpers({
	roundPrep: function () {
		return !Round.started();
	},
	armyList: function () {
		return Player(Session.get('showArmyList')).armyList();
	},
	armyOwner: function () {
		var id = Session.get('showArmyList');
		if (id && id !== Player().id()) {
			return Player(id).armyName();
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
		Player().armyList($('#armyList').val());
		$('#submitArmyList').attr('disabled', true);
	}
});

Template.allArmies.helpers({
	players: function () {
		var p = players.find().fetch();
		_.each(p, function (player) {
			player.regions = regions.find({owner: player._id}).count();
		});
		p = _.sortByOrder(p, ['regions', 'armyName'], ['desc', 'asc']);
		return p;
	},
	icon: function () {
		return (images.findOne({_id: this.icon}) || {}).data;
	},
	me: function () {
		return this._id === Player().id() ? 'me' : '';
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
