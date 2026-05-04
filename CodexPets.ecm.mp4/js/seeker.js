(function (){

	var parse = function (selector, regEx) {
		this.selector	= selector;
		this.regEx		= regEx;
		this.init();
		this.bindEvent();

		return $(this.selector);
	};

	parse.prototype = {

		init: function(){
		var _ = $(this.selector).html() || '';
			var tmp = _.replace(this.regEx, "<span role='seeker' class='seeker' pos='$1$3$4'>[$1$3$4]</span>");
			$(this.selector).html( tmp );
		},

		bindEvent: function(){
			var _this = this;

			$(this.selector).find('[role="seeker"]').click(function(){

				if ( typeof fs.video == 'undefined' || !fs.video.isReady() ) return;

				var pos = fs.util.timeToPos( $(this).attr('pos') ) / 1000;

				fs.video.focus();
				fs.video.setPos( pos );
			});
		}
	};

	$.fn.seeker = function (regEx) {

		/*
		符合時間格式：
			1. 時間數字必須合理，符合60進位
			2. 至少要有一個冒號，有分秒，不能只有秒數
			3. 秒數必須有兩位數
			4. 有小時的時候，分鐘必須為兩位數
			5. 小數只能有一位
			6. 時間之中不能有空格或其他字元
		*/
		if ( typeof regEx == 'undefined' ) regEx = /\[(([0-5]?[0-9]:)?[0-5])?([0-9]:[0-5][0-9])(\.[0-9])?\]/g;

		return new parse(this, regEx);
	};
})();
