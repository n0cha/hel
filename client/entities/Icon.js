Icon = function (id) {
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
