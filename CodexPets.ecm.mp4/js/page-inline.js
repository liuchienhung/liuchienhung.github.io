function popupLinkfy() {

    if ($('div[type="editor"]').length > 0) return;
    $('a[target="_popup"]').each(function(idx, itm) {

        var _rel = (typeof $(this).attr('rel') === 'undefined') ? [] : $(this).attr('rel').split(',');

        var def = new Array();
        def.push('autoxauto');
        def.push(0);

        if (!_rel[0]) _rel[0] = def[0];
        if (!_rel[1]) _rel[1] = def[1];

        var _size = _rel[0].split('x');

        _size[0] = (_size[0] == 'auto') ? 760 : _size[0];
        _size[1] = (_size[1] == 'auto') ? 500 : _size[1];

        var videoOnly = _rel[1];

        var parser = document.createElement('a');
        parser.href = $(this).attr('href');


        var _param = (parser.search == '') ? '?popup=true&output=embed&videoOnly=' + videoOnly : '&popup=true&output=embedvideoOnly=' + videoOnly;
        parser.search += _param;

        $(itm).fancybox({
            type: 'iframe',
            preload: true,
            autoWidth: false,
            autoHeight: true,
            autoResize: false,
            href: parser.href,
            padding: 5,
            title: function() {
                var _href = ($(this).data('url') == undefined) ? $(this).attr('href') : $(this).data('url');
                return $('<a>', {
                    href: _href,
                    html: _T('app_oriUrl') + ': ' + _href,
                    target: '_blank'
                }).wrapAll('<tmpl>').parent().html();
            },
            titleShow: true,
            margin: 20,
            beforeLoad: function() {

                this.width = parseInt(_size[0], 10);
                this.height = parseInt(_size[1], 10);

                fs.event.trigger('popupLinkfy.beforeLoad');

            },
            afterShow: function() {
                fs.event.trigger('popupLinkfy.afterShow');
            }
        });

        // $(this).removeAttr('target');
    });
}



function SyntaxHighlighterInit() {
    SyntaxHighlighter.autoloader.apply(null, path(
        'actionscript3 as3      @shBrushAS3.js',
        'bash shell             @shBrushBash.js',
        'cpp c                  @shBrushCpp.js',
        'c# c-sharp csharp      @shBrushCSharp.js',
        'css                    @shBrushCss.js',
        'xml                    @shBrushXml.js',
        'java                   @shBrushJava.js',
        'js jscript javascript  @shBrushJScript.js',
        'perl pl                @shBrushPerl.js',
        'php                    @shBrushPhp.js',
        'text plain             @shBrushPlain.js',
        'py python              @shBrushPython.js',
        'ruby rails ror rb      @shBrushRuby.js',
        'sql                    @shBrushSql.js',
        'vb vbnet               @shBrushVb.js'
    ));

    SyntaxHighlighter.vars.discoveredBrushes = null;

    SyntaxHighlighter.defaults['toolbar'] = false;
    SyntaxHighlighter.defaults['smart-tabs'] = true;

    SyntaxHighlighter.all();

    function path() {
        var args = arguments,
            result = [];
        for (var i = 0; i < args.length; i++) result.push(args[i].replace('@', '/sys/js/syntaxhighlight/'));
        return result;
    }
}


$(document)
    .bind('syntaxhighlight', function() {
        SyntaxHighlighterInit();
    }).bind('popupLinkfy', function() {
        popupLinkfy();
    })
    .bind('ExtUrllinkfy', function() {
        var regex = new RegExp(window.location.host);
        $('a:not([target="_blank"]):not([target="_popup"]):not([target="_self"])')
            .filter(function() {
                return this.href.match(/^(https?:\/\/)/) })
            .filter(function() {
                return !regex.test(this.href);
            })
            .filter(function() {
                return !this.href.match(window.App.hrefFilterStr) })
            .attr("target", "_blank");
    });

var _windowLoadEvents = ['popupLinkfy', 'syntaxhighlight', 'ExtUrllinkfy'];

function removeWindowLoadEventsEvent(e) {
    var index = _windowLoadEvents.indexOf(e);
    _windowLoadEvents.splice(index, 1);
}

$.extend({
    ping: function() {
        var d = new Date();
        $.post('/index/ping', { time: d.getTime() }, function(obj) {});
    }
});

setInterval("$.ping()", 60 * 60 * 1000);

$(function() {
    $.each(_windowLoadEvents, function(idx, item) {
        $(document).trigger(item);
    })

    // common script
    // js-fs-modal
    $('.js-fs-modal').click(function(e) {
        e.preventDefault();
        if ($(this).hasClass('disabled') || $(this).closest('.disabled').length) {
            return false;
        }
        var that = $(this),
            box = fs.box.dialog({
                title: fs.util.escape(that.data('title') || this.title || this.innerHTML),
                subTitle: fs.util.escape(that.data('sub-title')),
                url: that.data('url') || this.href || that.attr('href'),
                width: that.data('width'),
                height: that.data('height')
            })
    });

    // js-fs-modal-form
    $('.js-fs-modal-form').click(function(e) {
        e.preventDefault();

        if ($(this).hasClass('disabled') || $(this).closest('.disabled').length) {
            return false;
        }

        var that = $(this),
            box = fs.box.dialog({
                title: fs.util.escape(that.data('title') || this.title || this.innerHTML),
                subTitle: fs.util.escape(that.data('sub-title')),
                url: that.data('url') || this.href || that.attr('href'),
                width: that.data('width'),
                height: that.data('height'),
                buttons: [{
                    label: that.data('save-text') || _T('ok'),
                    className: 'btn btn-primary',
                    callback: function() {
                        box.find("iframe")[0].contentWindow.jQuery("body").trigger('form.beforeSubmit');
                        if (box.find("iframe")[0].contentWindow.jQuery("form").length) {
                            box.find("iframe")[0].contentWindow.jQuery("form").trigger('submit');
                        }
                        return false;
                    }
                }, {
                    label: _T('cancel'),
                    className: 'btn'
                }]
            })
    });

    // js-fs-confirm-ajax
    $('.js-fs-confirm-ajax').click(function(e) {
        e.preventDefault();
        var that = $(this),
            title = _T('cfmDel');
        if (that.hasClass('disabled') || that.closest('.disabled').length) {
            return false;
        }

        if (typeof that.data('title') !== 'undefined') {
            title = _T('cfmDel-item', { '%name%': that.data('title') });
        }

        if (confirm(title)) {
            $.post(that.data('url') || this.href || that.attr('href'), function(o) {
                if (o.ret.status !== 'true') {
                    alert(o.ret.msg);
                    return;
                }
                window.location.reload();
            }, 'json');
        }
    });

    // js-fs-ajax
    $('.js-fs-ajax').click(function(e) {
        e.preventDefault();
        var that = $(this);
        if (that.hasClass('disabled') || that.closest('.disabled').length) {
            return false;
        }

        $.post(that.data('url') || this.href || that.attr('href'), function(o) {
            if (o.ret.status !== 'true') {
                alert(o.ret.msg);
                return;
            }

            if (o.ret.alert) {
                alert(o.ret.alert);
            }

            if (o.ret.redirect) {
                window.location.href = o.ret.redirect;
                return;
            }

            window.location.reload();
        }, 'json');
    });

    $('.js-fs-form').on('change', 'input, select', function() {
        this.form.submit();
    });
});
