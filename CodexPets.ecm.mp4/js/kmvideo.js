var fs = fs || {};

fs.kmvideo = (function(){
	/*****
     NOTE:
     jQuery outerHeight() does not include margin in default!!
     using outerHeight(true) or outerHeight(##, true) to get or set including margin
    *****/
    var config = {
            "video" : {},
            "marginReserved": 20
        },
        resolutionList = [],
        isPlayingLayout = false,
    	isTabOpen = false,
        adjustingResolution = false,
    	transitionend = "transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd";

    // get max player size for auto selecting resolution
    // because  player-container padding becomes 0 in play-layout, add ext
    fs.video.player_width = get_max_player_width()  + extWidth('#player-container');
    fs.video.player_height = get_max_player_height() + extHeight('#player-container');

    // press play, chang to playing layout
    function playLayout() {
        if (isPlayingLayout) return;

    	// hide infoindex
        $("#infoindexFrame").remove();

        //show tab container
        $("#sideFrame").removeClass('hide');

        // centralize video-container
        $("#videoFrame").removeClass("col-md-8");
        $('#video-container').addClass("play-layout");

        // maximize player-container
        $("#player-container").addClass("play-layout").height($("#player-container").height() + extHeight('#video-container')); // 播放時，全版
        $('#playerFrame').addClass("play-layout");

        // size changing animation
        transitionOnce(['#player-container', '#videoBox']);
        videoBoxResponse();

        isPlayingLayout = true;
    }


    function toggleSideFrame(show) {
        if (show) { // show
            $("#playerFrame").addClass('tab-open');
            isTabOpen = true;
        }
        else { // hide
            $("#playerFrame").removeClass('tab-open');
            isTabOpen = false;
        }

        transitionOnce(['#videoBox', '.canvas-container', '.drawing-panel:visible', '#videoFrame', '#sideFrame']);
        videoBoxResponse();
    }

    function toggleSideBox(role, show) {
        var that = $(this),
            roleIcon = $('#controlPanel .side-control[role="' + role + '"]'),
            roleBox = $('#side-container .side-box[role="' + role + '"]'),
            curBox = $('#side-container .side-box.active');

        if (show) { // show

            if ( window.innerWidth < 640 ) {
                return;
            }

            if (!isPlayingLayout) {
                playLayout();
            }

            if (roleBox.hasClass('active')) return;

            if ( curBox.length < 1 ) { // sideFrame not opened
                // open sideFrame
                toggleSideFrame(true);

                // show roleBox
                roleBox.addClass('active').stop().fadeIn(200);
                roleBox.find('.fs-tab [data-toggle="tab"]').first().tab('show');
            } else {
                // hide current side-box
                curBox.removeClass('active').hide();
                // deactivate tab
                curBox.find('.tab-pane.active, .nav > .active').removeClass('active');
                
                // show role side-box
                roleBox.addClass('active').show();
                // activate the first tab
                roleBox.find('.fs-tab [data-toggle="tab"]').first().tab('show');
            }

            // activate icon
            $('#controlPanel .side-control').removeClass('active');
            roleIcon.addClass('active');

        } else { // hide
            if (!roleBox.hasClass('active')) return;

            // hide roleBox
            roleBox.removeClass('active').stop().fadeOut(300);
            // deactivate tab
            roleBox.find('.tab-pane.active, .nav > .active').removeClass('active');

            // close sideFrame
            toggleSideFrame(false);

            // inactivate
            roleIcon.removeClass('active');
        }


        // video quiz disable when editing quiz
        if ( role == 'quizEdit' && fs.ques ) {
            if (show) fs.ques.disableQuiz();
            else fs.ques.enableQuiz();
        }

        // refresh noteStat chart when opening noteBox, to fix wrong initial axis alignment problem #57717
        if ( role == 'note' && show && fs.noteStat ) {
            fs.noteStat.refreshChart();
        }
    }


    function videoBoxResponse() {
        var max_player_height = get_max_player_height(),
            max_player_width = get_max_player_width(),
            video = config.video,
            video_ratio = (video.size.width) / (video.size.height);

        // for resolution response
        fs.video.player_width = max_player_width;
        fs.video.player_height = max_player_height;

        resolutionResponse();

        // if video size is smaller than max size, set player as high as video
        if ( video.type == 'html5' && (video.size.height) <= max_player_height ) {
        	max_player_height = video.size.height;
        }

        // when window is narrow
    	if ( max_player_width / max_player_height  <= video_ratio ) {
            // 1. limit player height to avoid top and bottom blank
    		max_player_height = max_player_width / video_ratio;

            // 2. remove video-container padding to expand the video
            if ( !$('#video-container').hasClass('narrow-page') ) {
                // remove #video-container padding
                $('#video-container, #sideFrame').addClass('narrow-page');
                videoBoxResponse(); // calculate again
                return;
            }

    	} else { // when window is wide
            // remove video-container padding to expand the video
            if ( $('#video-container').hasClass('narrow-page') ) {
        		$('#video-container, #sideFrame').removeClass('narrow-page');
                videoBoxResponse(); // calculate again
                return;
            }
    	}

        // 1 set size of player-container
        $("#player-container").height(max_player_height);


        // 2. max videoBox height
        var max_height = max_player_height - extHeight("#video-container");  // 避開 css border / margin / padding 設定

        // 3. max videoBox width
        var max_width = max_player_width - extWidth("#video-container");
        if (isTabOpen) { max_width -= $('#side-container').outerWidth(); }

        // 4. resize VideoBox
        targetSize = getTargetSize(max_width, max_height);
        $("#videoBox").width(targetSize[0]).height(targetSize[1]);

        // 5. video-container vertical align center
        var marginTop = ( max_height - targetSize[1] ) / 2;
        $("#videoBox").css({"margin-top": marginTop, "margin-bottom": marginTop});

        // 6. resize drawings
        drawingCanvasResponse(targetSize[0], targetSize[1]);

    }

    function resolutionResponse() {
        if ( config.video.type != 'html5') return;
        if ( adjustingResolution ) return;
        if ( fs.video.isUserSelectedResolution() ) return;

        // when window size is large enough to contain a player larger than current video size
        if (fs.video.player_height >= config.video.size.height && fs.video.player_width >= config.video.size.width) {
            // select the smallest size which is larger than player
            var key = fs.video.autoSelectVideo();
            fs.video.setResolution(key)

            /* small window -> enlarge window -> play , setResolution will fail. Following solve this problem but not reliable */
            // var setResolution = function(){
            //     // setResolution return false when pressing play
            //     if (!fs.video.setResolution(key)) {
            //         setTimeout(setResolution, 100);
            //     }
            // }
            // setResolution();
        }
    }

    function drawingCanvasResponse(w, h) {
    	var resizeRatio = w / $('.canvas-container:visible').width();


        if ( $('.canvas-container:visible').hasClass('transitionOn') ) {
        	// transform scale during transition, resize canvas after transition
        	$('.canvas-container').css('transform', 'scale(' + resizeRatio + ')');
        	$('.canvas-container').one(transitionend, function(){
        		$('.canvas-container').css('transform', "");
        		fs.event.trigger('video.resizer');
        	});

        	// move drawing-panel
        	fs.videoDrawing.updateDrawingPanelSize(w, h);


        } else {
        	fs.event.trigger('video.resizer');
        }
    }

    function showHashElement() {
        var hash = window.location.hash,
            sideTargetRole,
            activeBox;

        /* if hash element is in side-container */
        if ($('#side-container').find(hash).length>0) {

            if ( window.innerWidth < 640 ) {
                return;
            }

            if (!isPlayingLayout) {
                // switch to playLayout and call showHashElement again after transition
                $('#playerFrame').on(transitionend, function(){
                    showHashElement();
                    $(this).off(transitionend);
                });
                playLayout();
                return;
            }


            sideTargetRole = $(hash).closest('.side-box').attr('role');

            // show the target side box
            toggleSideBox(sideTargetRole, true);

            /* return if hash element is tab pane, avoid scrolling */
            if ( $(hash).hasClass('tab-pane') ) return;
       
            // show hidden comment if any
            fs.event.trigger('show.hidden.hash.comment');

            // side-container scroll to top of hash element
            activeBox = $('#side-container .side-box.active');
            $('#side-container').animate({
                // because there are several position:relative divs, using position() will be inaccurate
                // hence use offset instead.
                scrollTop: $(hash).offset().top - activeBox.offset().top
            }, 300, 'swing', function(){
                fs.event.trigger('hashchange.scroll.finished');
            });

            // whole page scroll to top
            $('body, html').animate({
                scrollTop: 0
            }, 300);


        /* if hash element is not in side-container */
        } else {
            // $('body, html').animate({
            //     scrollTop: $(hash).offset().top
            // }, 300, 'swing', function(){
            //     fs.event.trigger('hashchange.scroll.finished');
            // });
        }
    }


    // helper function
    function extHeight(id) { return $(id).outerHeight(true) - $(id).height(); }
    function extWidth(id)  { return $(id).outerWidth(true) - $(id).width();  }

    function transitionOnce(selector, callback) {
        // transitionOn property defined in css file
        $.each(selector, function(k, v){
            $(v)
            .addClass('transitionOn')
            .off(transitionend)
            .one(transitionend, function(e){
                if( !$(this).is(e.target) ) return;
                $(this).removeClass('transitionOn');
                $('body').trigger('transitionOnce.end');
            });
        });
        $('body').one('transitionOnce.end', function(){
            if( typeof callback !== 'undefined' ) callback();
        })
    }
    function get_max_player_height() {
        /* max player height, outerHeight() - (margin + border + padding)
         * use window.innerHeight which included height of bottom scrollbar instead of $(window).height() to avoid jumping layout
         */
        var maxPlayerHeight = window.innerHeight - $("#sys").outerHeight(true) - extHeight("#player-container") - config.marginReserved;
        if (maxPlayerHeight >= 600) {
            maxPlayerHeight -= $("#ctrlFrame").outerHeight(false);
        }

        return maxPlayerHeight;
    }
    function get_max_player_width() {
        return $("#player-container").width();
    }
    function getTargetSize(maxW, maxH) {
        var video = config.video,
            videoBox_ratio = maxW / maxH;

        // determine max size
        var _w, _h;
        if (videoBox_ratio > video.ratio) {
            // wider, maximize height
            _h = maxH;
            _w = _h * video.ratio;
        }
        else {
            _w = maxW;
            _h = _w / video.ratio;
        }

        if ( video.type == 'html5' && _w > video.size.width) {
            // exceed video size
            _w = video.size.width;
            _h = video.size.height;
        }

        _w = Math.round(_w);
        _h = Math.round(_h);

        return [_w, _h];
    }


    /* get width of scrollbar
    */
    var scrollbarWidth = (function () {
        // this function was copied from http://stackoverflow.com/questions/13382516/getting-scroll-bar-width-using-javascript
        var outer = document.createElement("div");
        outer.style.visibility = "hidden";
        outer.style.width = "100px";
        outer.style.msOverflowStyle = "scrollbar"; // needed for WinJS apps

        document.body.appendChild(outer);

        var widthNoScroll = outer.offsetWidth;
        // force scrollbars
        outer.style.overflow = "scroll";

        // add innerdiv
        var inner = document.createElement("div");
        inner.style.width = "100%";
        outer.appendChild(inner);

        var widthWithScroll = inner.offsetWidth;

        // remove divs
        outer.parentNode.removeChild(outer);

        return widthNoScroll - widthWithScroll;
    })();

    /* In some browsers, including Chrome and Firefox on Windows system, scrollbars take space and make page size change.
     * To make sure that videobox has correct size, this detector calls videoBoxResponse when body's scrollbar appears/disappears.
     *
     * Use iframe as a detector since it triggers resize event when its size changes
    */
    function setRightScrollBarDetector() {
        // modify source code: https://gist.github.com/OrganicPanda/8222636

        // Create an invisible iframe
        var iframe = document.createElement('iframe');
        iframe.id = "scrollbar-resize-listener"; //SBRL
        iframe.style.cssText = 'height: 0; background-color: transparent; margin: 0; padding: 0; overflow: hidden; border-width: 0; position: absolute; width: 100%;';

        // Register our event when the iframe loads
        iframe.onload = function() {
            // The trick here is that because this iframe has 100% width
            // it should fire a window resize event when anything causes it to
            // resize (even scrollbars on the outer document)
            iframe.contentWindow.addEventListener('resize', function() {
                try {
                    var evt = new UIEvent('resize.SBRL');
                    window.dispatchEvent(evt);
                } catch(e) {}
            });
        };

        // Stick the iframe somewhere out of the way
        document.body.appendChild(iframe);




        var SBRL = document.getElementById('scrollbar-resize-listener'),
            hasScrollbar = ($(SBRL).width() < window.innerWidth);
            // when scrollbar exists, width of SBRL should be ( window.innerWidth - scrollbarWidth )

        window.addEventListener('resize.SBRL', function resized() {

            if ( !isPlayingLayout ) return;

            // scrollbar appears
            if ($(SBRL).width() < window.innerWidth && !hasScrollbar) {
                /* 1. calculate the height difference of player-container after scrollbar appears
                 * 2. set SBRL height higher than the height difference to prevent scrollbar disappear again
                 *
                 * Because when scrollbar appears, page width shrinks, height of player-container also shrinks.
                 * When all elements move upward as player-container shrinks, scrollbar will disappear again.
                 *
                 * At certain margin size, the height difference will cause repeating appear and disappear,
                 * which brings a jumpy page.
                 *
                 * Hence it is necessary to append a block at the bottom of the body (using SBRL in this case)
                 * to prevent the problem above.
                */
                var heightDiff = scrollbarWidth * $('#player-container').height() / $('#player-container').width();

                $(SBRL).height(heightDiff + 20 );
                videoBoxResponse();
                hasScrollbar = true;
            }
            // scrollbar disappears
            else if ($(SBRL).width() == window.innerWidth && hasScrollbar) {
                // When scrollbar disappears, remove SBRL height.
                $(SBRL).height(0);
                videoBoxResponse();
                hasScrollbar = false;
            }
        });
    }

    function initializeConfig() {
        var w,
            h;

        config.video.type = fs.video.getPlayerType();

        if (config.video.type == 'html5') {
            config.video.size = fs.video.getResolution();
            config.video.size.width = parseInt(config.video.size.width);
            config.video.size.height = parseInt(config.video.size.height);
            config.video.ratio = config.video.size.width / config.video.size.height;
            resolutionList = fs.video.getResolutionList();
            $.each(resolutionList, function(k, v){
                resolutionList[k]['width'] = parseInt(resolutionList[k]['width']);
                resolutionList[k]['height'] = parseInt(resolutionList[k]['height']);
            });

            // 計算顯示的寬、高將寬度撐滿，缺點是整個高度會超過
            // 原則: 將寬度撐滿
            // 缺點: 整個高度可能會超過 document 的高，播放時，可能也會變小
            w = config.initWidth;
            if (config.video.size.width < config.initWidth) {
                // video 原始大小比顯示寬度小，最大 1:1 顯示
                w = config.video.size.width;
            }
            h = (config.video.size.height / config.video.size.width) * w;

        } else if (config.video.type == 'embed') { // embed
            config.video.size = fs.video.getSize();

            config.video.ratio = config.video.size.width / config.video.size.height;
            w = config.video.size.width = config.initWidth;
            h = config.video.size.height = config.video.size.width / config.video.ratio;
        }

        w = Math.round(w);
        h = Math.round(h);
        $('#videoBox').prev('.loading').remove();
        $('#videoBox').width(w).height(h);
        $('#player-container').height(h);

        setRightScrollBarDetector();
    }

    function bindEvent() {

        // click side control icon
        $('#controlPanel .side-control').click(function(){
            var role = $(this).attr('role');

            if ($(this).hasClass('active')) {
                toggleSideBox(role, false);
            } else {
                toggleSideBox(role, true);
            }
        });

        // click fullscreen icon
        $('#controlPanel .control-btn[role="fullscreen"]').click(function(){
            fs.video.toFullscreen();
            if (!isPlayingLayout) {
                playLayout();
            }
        });

        // close-side X button
        $('#side-container').append('\
            <div class="side-close">\
                <div class="side-close-container">\
                    <i class="line-1"></i>\
                    <i class="line-2"></i>\
                </div>\
            </div>');

        // click X to close side frame
        $('#side-container .side-close').click(function(){
            var currentSideBox = $('#sideFrame .side-box.active'),
                role = currentSideBox.attr('role');

            // close side
            toggleSideBox(role, false);
        });

        // switch to playlayout when playing video
        fs.event.registerOne('player.play', function(){
            if (!config.disableFullPage) {
                playLayout();
            }
        });

        fs.event.register('respond.video', videoBoxResponse);

        $(window).resize(function(){
            var matchWindowWidth1200 = window.matchMedia('(min-width: 1200px)').matches;

            if ( !isPlayingLayout ) {
                if (matchWindowWidth1200) {
                    return;
                }
                else {
                    playLayout();
                }
            }

            if ( window.innerWidth < 640 ) {
                isTabOpen = false;
            } else if ( $("#playerFrame").hasClass('tab-open') ) {
                isTabOpen = true;
            }

            $('.transitionOn').removeClass('transitionOn');
            videoBoxResponse();
        });

        // call videoBoxResponse after new resolution loaded
        fs.event.register('player.onResolutionChanged', function(){

            adjustingResolution = true;

            transitionOnce(['#player-container', '#videoBox']);
            config.video.size = fs.video.getResolution();
            videoBoxResponse();

            $('#fsPlayer').on('player.newResolution.loaded', function(){
                adjustingResolution = false;
            });
        });


        // on hash changed, show the side box which contains the hash element
        $(window).bind( 'hashchange', showHashElement);
    }



    function afterInitialize() {
        bindEvent();

        if (window.location.hash) {
            showHashElement();
        }
    }


    return {
        init: function(param){
            var param = param || {};
            config.initWidth = $("#video-container").width();
            config.disableFullPage = (typeof param.disableFullPage !== 'undefined') ? param.disableFullPage
                                                                                    : false;
            config.video.type = fs.video.getPlayerType();

            if (config.video.type === 'embed') {
                /* if is embed, initialize */
                initializeConfig();
                afterInitialize();
            } else {
                /* if is not embed, wait until player is ready for video info */
                fs.event.registerOne('player.videoReady', function(){
                    initializeConfig();
                    afterInitialize();
                });

                fs.event.registerOne('player.loadFail', function(){
                    /* set videoBox size as videoFrame to show error msg*/
                    $('#videoBox').width($("#videoFrame").width()).height($("#videoFrame").height());
                    $('#mediaBox').addClass('loadFail');
                    $('#videoBox').prev('.loading').remove();
                });
            }
        }
    };
})()