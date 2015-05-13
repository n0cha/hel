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

var nrOfBanners = 3;

Template.menu.helpers({
	menuItems: function () {
		return [
			{name: 'home', title: 'Home'}
		].concat(Meteor.userId() ? [
			{name: 'armies', title: 'Armies'},
			{name: 'game', title: 'Game'},
			{name: 'chat', title: 'Chat'}						
		] : []);
	},
	selected: function () {
		return this.name === Session.get('currentPage') ? '_selected' : '';
	}
});

Template.menu.rendered = function () {
	//var $stickyMenu = $('#menu.sticky');
	var menuTop = $('#menu').offset().top;
	$(window).on('scroll', function () {
		if ($(window).scrollTop() > menuTop) {
			$(document.body).addClass('sticky');
			//$stickyMenu.show();
		} else {
			$(document.body).removeClass('sticky');
			//$stickyMenu.hide();
		}
	});
	
	//var banner = Math.floor((new Date()).getMinutes() / (60 / nrOfBanners)) + 2;
	//$('#header').css({backgroundImage: 'url(images/hel' + banner + '.png)'});
	var banner = Math.floor(Math.random() * nrOfBanners) + 1;
	var setBanner = function () {
		var $banner = $('#banner' + banner);
		
		$('.banner').not($banner)
				.addClass('hidden')
		;
		
		$banner
				.addClass('animate')
				.toggleClass('right')
				.removeClass('hidden')
		;
		
		banner = banner === nrOfBanners ? 1 : banner + 1;
	};
	setBanner();
	setInterval(setBanner, 29000);
};

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
