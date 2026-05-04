fs.ques.selection = (function(){

	var id, quiz, lang, extParam;
	var ansAry = '0ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

	var tmpl = {
			quiz : fs.tmpl('\
				<div role="subject" class="subject">\
					<div class="question clearfix">{%# o.question %}</div>\
                    <div class="multiselectMsg hint">{%= o.multiselectMsg %}</div>\
					<ul class="answer {% if (o.multiline != "1") { %} single-line {% } %} clearfix">\
						{% for (var i=0; i<o.item.length; i++) { var item = o.item[i]; %}\
							<li>\
								<label itemId="{%= item.value %}" role="item" class="item clearfix">\
									<input name="item" type="{%= item.type %}" value="{%= item.value %}">\
									<div class="q">{%= item.sn %}. {%= item.answer %}</div>\
								</label>\
							</li>\
						{% } %}\
					</ul>\
				</div>\
				<div class="clearfix">\
					<div role="panel" class="panel clearfix">\
						<button role="submit" class="btn btn-success pull-right" disabled>{%= o.lang.submit %}</button>\
						<a href="javascript:void(0)" role="bypass" class="pull-right" {% if (o.bypass != 1) { %} style="display:none" {% } %} >{%= o.lang.bypass %}</a>\
						<a href="javascript:void(0)" role="resizer" class="pull-left" >{%= o.lang.hide %}</button>\
						<a class="pull-right" href="javascript:void(0)" role="next" style="display:none">{%= o.lang.continue %} &gt;&gt; </a>\
					</div>\
				</div>\
				<div role="explain" class="explain clearfix"></div>\
			'),

			rightAnswer : fs.tmpl('<div role="rightAnswer" class="rightAnswer clearfix">\
										<div class="response">{%= o.lang.right %}: {%= o.right %}</div>\
										<div>{%# o.note %}</div>\
									</div>'),

			wrongAnswer : fs.tmpl('<div role="wrongAnswer" class="wrongAnswer clearfix">\
										<div class="response">{%= o.lang.wrongAnswer %} <a role="showAnswer" style="margin-left:15px" href="javascript:void(0)">{%= o.lang.showAnswer %}</a></div>\
									</div>'),

			wrongDetail : fs.tmpl('<div role="wrongDetail" class="wrongDetail clearfix">\
										<div class="response">{%= o.lang.right %}:  {%= o.right %}</div>\
										<div>{%# o.note %}</div>\
									</div>')
	};

	return {

		init : function( i, q, l, itm, prm ) {

			id = i;
			quiz = q;
			lang = l;
			extParam = prm;

			var data = JSON.parse( q.json ),
				type = ( data.ques_sel_type == 'single' ) ? 'radio' : 'checkbox';

            var	multiselectMsg = ( data.ques_sel_type == 'single' ) ? '' : " (" + lang.multiselect + ")";
			var item = new Array();

			for ( var i=1; i<=data.ques_sel_opt_cnt; i++ ) {

				item.push( {
					'sn'		: ansAry[i],
					'value'		: i,
					'answer'	: $.trim( data['ques_sel_opt' + i] ),
					'type'		: type
				} );
			}

			var args = JSON.parse( quiz.config );

			return tmpl.quiz({
				question	: quiz.question,
                multiselectMsg	: multiselectMsg,
				multiline	: data.ques_sel_multiline,
				item		: item,
				lang		: lang,
				bypass		: ((args.bypass == "true") || (typeof extParam.answeredQId[quiz.questionId] !== "undefined")) ? 1 : 0
			});
		},

		setupEvent : function() {
			var selector	= $('#' + id),
				self		= this;

			var args = JSON.parse( quiz.config );

			var btn = {
				'resizer'	: selector.find('[role="resizer"]'),
				'submit'	: selector.find('[role="submit"]'),
				'next'		: selector.find('[role="next"]'),
				'bypass'	: selector.find('[role="bypass"]')
			};

			var item = selector.find('[name="item"]');

			item.change(function(){

				item.closest('label').removeClass('selected');

				$.each(selector.find('[name="item"]:checked'), function(k, v){
					$(v).closest('label').addClass('selected');
				});

				btn.submit.prop('disabled', ( selector.find('[name="item"]:checked').length > 0 ) ? false : true);
			});

			btn.submit.click(function(){

				var pass = self.verify(selector);

				fs.event.trigger('quiz.submit', quiz.questionId);

				if ( pass.status == false ) {
					self.showWrongMsg( selector, pass );
					return;
				}

				self.showAnswer( selector, pass );
				btn.next.show();
			});

			btn.next.click(  function(){ self.next(); });
			btn.bypass.click(function(){ self.next(); });

			btn.resizer.click(function(){ self.reizer(); });
		},

		verify : function( selector ){

			var data		= JSON.parse( quiz.json ),
				checked		= selector.find('[name="item"]:checked');

			var choose	= new Array(),
				ans		= new Array();

			if ( data.ques_sel_type == 'single' ) {
				ans.push( data.ques_ans );
				choose.push( checked.val() );

			} else {
				$.each( checked, function(k, v){ choose.push( $(v).val() ); });
				$.each(data.ques_ans.split(','), function(k, v){ ans.push( v ); });

				choose.sort();
				ans.sort();
			}

			var pass = ( ans.join(',') == choose.join(',') ) ? true : false;
			
			/* do not send submit in evercam-exported page */
			// $.post(extParam['videoQuesSubmitUrl'], {quesID: quiz.id, choose: choose.join(','), pass: pass}, function(obj){
			// 	if (obj.ret.status === 'false') {
			// 		alert(obj.ret.msg);
			// 		return;
			// 	}
			// }, 'json');

			return {status: pass, right: ans, choose: choose};
		},

		showAnswer : function( selector ) {

			var explain = selector.find('[role="explain"]');
			explain.hide();
			explain.html('');

			var data = JSON.parse( quiz.json ),
				note = $.trim( data.ques_notes );

			var ans = data.ques_ans.split(/,/g),
				ra = new Array();

			selector.find('[name="item"]').prop('checked', false);

			$.each(ans, function(k, v) {
				selector.find('[name="item"][value="' + v + '"]').prop('checked', true);
				ra.push( v );
			} );

			var right	= this.getAlpha( ra );

			var rightAnswer = tmpl.rightAnswer( {
				lang	: lang,
				right	: right.join(', '),
				note	: note
			} );

			var item = selector.find('[name="item"]');

			item.prop('disabled', true);
			item.closest('label').removeClass('selected');

			item.unbind('change');

			explain.append( rightAnswer );

			this.showExplain( explain );

			selector.find('[role="submit"]').hide();
			selector.find('[role="bypass"]').hide();

			return true;
		},

		getAlpha : function ( opt ){
			var o = new Array();
			$.each(opt, function(k, v){ o.push( ansAry[v] ); });

			return o;
		},

		showWrongMsg : function( selector, pass ){

			var explain	 = selector.find('[role="explain"]');
			explain.hide();
			explain.html('');

			var data = JSON.parse( quiz.json ),
				note = $.trim( data.ques_notes );

			var choose	= this.getAlpha( pass.choose ),
				right	= this.getAlpha( pass.right );

			var args = JSON.parse( quiz.config );

			explain.append( tmpl.wrongAnswer( { lang : lang } ) );

			var self = this;
			selector.find('[role="showAnswer"]').click( function(){ self.showWrongDetailMsg( selector, pass ); } );

			this.showExplain( explain );

			return true;
		},

		showWrongDetailMsg : function(selector, pass){

			var explain	 = selector.find('[role="explain"]');
			explain.hide();
			explain.html('');

			var data = JSON.parse( quiz.json ),
				note = $.trim( data.ques_notes );

			var right = this.getAlpha( pass.right );

			selector.find('[name="item"]').prop('disabled', true);

			var args = JSON.parse( quiz.config );

			explain.append( tmpl.wrongDetail( {
				right : right.join(', '),
				lang  : lang,
				note  : note
			} ) );

			selector.find('[role="submit"]').hide();
			selector.find('[role="bypass"]').hide();
			selector.find('[role="next"]').show();

			this.showExplain( explain );

			return true;
		},

		showExplain: function( explain ){
			explain.slideDown('fast', function(){
				/* scroll quiz to explain (in narrow (short) window) */
				$(this).closest('.quiz').animate({ scrollTop: explain.offset().top }, 300);
			});
		},

		next	: function(){ fs.ques.next(id);		},
		reizer	: function(){ fs.ques.minimize(id); },

		strip_tags : function(input, allowed) {

			allowed = (((allowed || '') + '').toLowerCase().match(/<[a-z][a-z0-9]*>/g) || []).join(''); // making sure the allowed arg is a string containing only tags in lowercase (<a><b><c>)

			var tags = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi,
			commentsAndPhpTags = /<!--[\s\S]*?-->|<\?(?:php)?[\s\S]*?\?>/gi;

			return input.replace(commentsAndPhpTags, '').replace(tags, function($0, $1) {
				return allowed.indexOf('<' + $1.toLowerCase() + '>') > -1 ? $0 : '';
			})
		}
	}

})();
