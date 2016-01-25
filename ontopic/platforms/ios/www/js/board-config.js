"use strict";


$(function() {
    var touch = device.tablet() || device.mobile();
    var clickEvent = 'click';
    FastClick.attach(document.body);
    var symbolSize = 40;

    function touchEvents(table) {
        var tnew = {};
        _.each(_.keys(table), function(k) {
            tnew[k.replace("click", clickEvent)] = table[k];
        });

        return tnew;
    }
    
    function rect($el) {
        var rect = {
            left: $el.offset().left,
            top: $el.offset().top,
            width: $el.width(),
            height: $el.height()
        };
        rect.right = rect.left + rect.width;
        rect.bottom = rect.top + rect.height;
        return rect;
    } 

    function intersect(rect1, rect2) {
        return !(rect2.left > rect1.right ||
                 rect2.right < rect1.left ||
                 rect2.top > rect1.bottom ||
                 rect2.bottom < rect1.top);
    }

    function inside(rect, point) {
        var i = point.x >= rect.left &&
            point.x <= rect.right &&
            point.y >= rect.top &&
            point.y <= rect.bottom;
        return i;
    }

    function expand(rect, px) {
        rect.left -= px;
        rect.top -= px;
        rect.width += 2*px;
        rect.height += 2*px;
        rect.right += px;
        rect.bottom += px;
        console.log(px);
        return rect;
    }

    
    window.Board = Backbone.Model.extend({
        initialize: function() {
            
        },
        defaults: function() {
            return({
                name: "",
                board: "color5",
                circle: "color3",
                symbol: "star",
                topic: "Topic",
                goal: 5,
                current: 0,
                missed: 0,
                playing: false,
                record: true,
                sounds: true,
                animations: true
            });
        },
        onoff: function(prop) {
            return this.get(prop) ? 'ON' : 'OFF';
        },
        resetCounts: function() {
            this.set('current', 0);
            this.set('missed', 0);
        },
        settings: function() {
            return _.pick(this.attributes, [
                'board',
                'circle',
                'symbol',
                'record',
                'sounds',
                'animations'
            ]);
        }
    });

    window.BoardHistory = Backbone.Collection.extend({
        model: Board,
        localStorage: new Backbone.LocalStorage("BoardPresets")
    });

    var BoardUI = Backbone.View.extend({
        $board: $("#board"),
        $circle: $("#circle"),
        $circle_topic: $("#circle-topic"),        
        $overlay: $("#overlay"),
        
        $el: $('body'),
        el: $('body')[0],
        
        events: touchEvents({
            "click #play": "play",
            "click .radio": "setRadio",
            "change #name": "setName",
            "change #topic": "setTopic",
            "change #goal": "setGoal",
            "click #done": "done",
            "click #overlay": "point",
            "click #reset": "reset",
            "click #stop": "stop",
            "click #record": "toggle",
            "click #sounds": "toggle",            
            "click #animations": "toggle",
            "click #delete-all": "deleteData",
            "click #excel": "toCSV"
        }),
        
        initialize: function() {
            var settings = this.readSettings();            
            this.history = new BoardHistory();
            this.history.fetch();
            this.newModel();
            this.sync();
            this.listenTo(this.model, 'change', this.sync);
            this.model.set(settings);
            this.makeTable();
        },

        newModel: function() {
            if (this.model) {
                var model = this.model;
                this.stopListening(model);
                this.model = model.clone();
            } else {
                if (this.history.size() > 0) {
                    this.model = this.history.last().clone();
                    this.model.set("name", "");
                    this.model.set("topic", "");
                } else {
                    this.model = new Board();
                }
            }
            this.model.set('id', null);
            
            this.listenTo(this.model, 'change', this.sync);
            this.model.resetCounts();
        },
        
        setRadio: function(e) {
            var $el = $(e.target);
            this.model.set($el.data('group'), $el.data('val'));
        },

        setTopic: function() {
            this.model.set('topic', $("#topic").val());
        },

        setName: function() {
            this.model.set('name', $("#name").val());
        },

        setGoal: function() {
            var goal = +$("#goal").val() || 0;
            
            this.model.set('goal', goal);           
        },
        
        sync: function() {
            var b = this.model.get('board');
            var c = this.model.get('circle');
            var s = this.model.get('symbol');
            
            this.$circle.attr("class", c);
            this.$board.attr("class", b);

            $(".selected").removeClass("selected");
            $("button[data-val='" + c + "'][data-group='circle']").addClass("selected");
            $("button[data-val='" + b + "'][data-group='board']").addClass("selected");
            $("button[data-val='" + s + "'][data-group='symbol']").addClass("selected");

            $("#name").val(this.model.get('name'));
            $("#topic").val(this.model.get('topic'));
            $("#goal").val(this.model.get('goal'));
            $("#topic-text").text(this.model.get('topic'));

            $("#record .state").text(this.model.onoff('record'));
            $("#sounds .state").text(this.model.onoff('sounds'));
            $("#animations .state").text(this.model.onoff('animations'));
            
            if (+this.model.get('goal') > 0) {
                $("#topic-goal").text(this.model.get('current') + "/" + this.model.get('goal'));

                if (this.model.get('goal') == this.model.get('current')) {
                    this.win();
                }
                $("#topic-goal").show();
            } else {
                $("#topic-goal").text(this.model.get('current'));
                $("#done").show();
            }

            this.saveSettings();
        },

        saveSettings: function() {
            localStorage.setItem('settings', JSON.stringify(this.model.settings()));
        },

        readSettings: function() {
            return JSON.parse(localStorage.getItem('settings'));
        },

        play: function() {
            this.model.set('current', 0);
            this.model.set('missed', 0);
            this.model.set('playing', true);
            this.model.set('started-on', new Date().toString());
            
            $("#circle-content").removeClass('expanded');
            $("#circle-topic").addClass('expanded');

            this.$overlay.html("");
            $(".symbol").remove();
            this.$overlay.show();

            $("#play").hide();
            $("#stop").removeAttr("disabled");
            $("#reset").removeAttr("disabled");            
        },

        main: function() {
            $("#stop").attr("disabled", "disabled");
            $("#reset").attr("disabled", "disabled");
            this.$circle.removeClass("animated");
            
            $("#circle-topic").removeClass("expanded");
            $("#circle-content").addClass("expanded");
            
            this.$overlay.hide();
            this.$overlay.html("");
            $(".symbol").remove();            
            this.newModel();
            
            $("#play").show();
            $("#done").hide();
            
        },

        done: function() {
            this.model.set('finished-on', new Date().toString());            
            this.save();
            this.main();
        },

        save: function() {
            this.history.add(this.model);
            this.model.save();
            this.makeTable();
        },
        
        point: function(e) {
            
            var self = this;
            var p = {
                x: e.originalEvent.pageX - symbolSize/2,
                y: e.originalEvent.pageY - symbolSize/2
            };

            this.$board.removeClass('uk-animation-shake');
            
            if (inside(expand(rect(this.$circle), -30), p) ||
                 !inside(expand(rect(this.$circle), +10), p)) {
                
                var $sym = $("<i class='uk-icon-" + this.model.get('symbol') + " symbol'></i>");

                if (inside(rect(this.$circle), p)) {
                    var circleRect = rect(this.$circle_topic);
                    
                    $sym.css({
                        position:"absolute",
                        left: 100*(p.x-circleRect.left)/circleRect.width + "%",
                        top: 100*(p.y-circleRect.top)/circleRect.height + "%"
                    });
                    
                    this.model.set('current', this.model.get('current')+1);
                    $sym.on('click', function(e) {
                        return false;
                    });

                    this.$circle_topic.append($sym);
                } else {
                    $sym.css({
                        position:"absolute",
                        left: 100*p.x/this.$overlay.width() + "%",
                        top: 100*p.y/this.$overlay.height() + "%"
                    });
                    this.model.set('missed', this.model.get('missed')+1);

                    if (this.model.get('animations'))
                        this.$board.addClass('uk-animation-shake');
                    
                    $sym.on(clickEvent, function() {
                        $sym.remove();
                        this.model.set('missed', this.model.get('missed')-1);                        
                    });
                    this.$overlay.append($sym);
                }
                
            }
            return false;
        },

        hideModals: function() {            
            UIkit.modal("#menu-modal").hide();
        },
        
        reset: function() {
            this.model.resetCounts();
            $(".symbol").remove();
            this.hideModals();
        },

        stop: function() {
            this.main();
            this.hideModals();
        },
        
        win: function() {
            if (this.model.get('goal') != 0) {
                if (this.model.get('animations')) {
                    this.$circle.addClass("animated pulse infinite");
                }
            }
            $("#done").show();
        },


        toggle: function(e) {
            var $el = $(e.target);
            
            var val = this.model.get($el.data('group'));
            this.model.set($el.data('group'), !val);
        },

        tableFields: ['started-on', 'name', 'topic', 'goal', 'current', 'missed', 'finished-on'],
        makeTable: function() {
            var tf = this.tableFields;
            $("#records-table").html("");

            this.history.each(function(m) {
                var a = _.values(_.pick(m.attributes, tf));
                
                $("#records-table").append("<tr><td>" + a.join("</td><td>") + "</td></tr>");
            });            
        },

        deleteData: function() {
            localStorage.clear();
            $("#records-table").html("");
            alert("All the data was deleted.");
            this.makeTable();
        },

        toCSV: function() {
            var tf = this.tableFields;
            var csv = [_.map($("th"), "innerHTML")].concat(
                this.history.map(function(m) {
                    return(_.values(_.pick(m.attributes, tf)));
                })
            );

            var csvString = "data:text/csv;charset=utf-8," + _.map(csv, function(row) {
                return '"' + row.join('","') + '"';
            }).join("\n");
            var uri = encodeURI(csvString);
            var $a = $("a")
                .attr("href", uri)
                .attr("download", 'ontopic.csv');
            $("body").append($a);
            _.defer(function() {
                $a[0].click();
                $a.remove();
            });
        }
            
    });

    window.App = new BoardUI();

    if (touch) {
        document.ontouchmove = function(event){
            event.preventDefault();
        };
    }

    if (window.cordova) {
        document.addEventListener(
            'deviceready', function() {
                window.cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
            }, false);
    }        
});
