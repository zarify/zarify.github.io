var duration;
var slots = ["start", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"];
var interval;
var current_timer;

function fmtTime(h, m) {
    // Format the time with 12 hour clock, pad out single digits

    var mer = "AM";
    if (h >= 12) { mer = "PM"; }
    if (h > 12) { h -= 12; } // 12 hour time for the munchkins
    if (m < 10) { m = "0"+m; } // pad out single digit minutes
    return [h, m, mer]
}

function startTimer() {
    // Called when the Start button is pressed

    // Begin the test
    var d = new Date();
    var m = d.getMinutes();
    var h = d.getHours();
    
    var t = fmtTime(h, m);
    h = t[0];
    m = t[1];
    var mer = t[2];

    var c = document.getElementById("start").firstElementChild;
    c.innerHTML = h + ":" + m + " " + mer;

    document.getElementById("button_start").style.display = "none";
    document.getElementById("timer").style.display = "table";

    // check the 'show emoji' checkbox, and hide the emoji class of divs
    // if it is unchecked
    var emoji = document.getElementsByClassName("emoji");
    var emoji_hide;
    
    if (document.getElementById("showemoji").checked == true) {
        //emoji_hide = "visible";
        emoji_hide = 100;
    } else {
        //emoji_hide = "hidden";
        emoji_hide = 0;
    }
    
    // hide or show the emoji elements, but leave document flow alone
    // visibility = hidden would be nicer for this, but that also hides
    // that area of the background colour of the parent div for some reason
    for (var i = 0; i < emoji.length; i++) {
        //emoji[i].style.visibility = emoji_hide;
        emoji[i].style.opacity = emoji_hide;
    }


    // Populate the time slots with the relevant time
    // Set callback timers for each of them to update their status
    
    var frag = duration / 10 * 60; // seconds in duration of test in tenths
    interval = frag * 1000; // interval between slots in ms
    for (var i = 0; i < slots.length; i++) {
        var target = new Date(d.getTime() + 1000 * (i+1) * frag); // time from start plus how many fragments
        var th = target.getHours();
        var tm = target.getMinutes();
        var bits = fmtTime(th, tm);
        document.getElementById(slots[i]).firstElementChild.innerHTML = bits[0] + ":" + bits[1] + " " + bits[2];
    }
    // callback for the first interval
    current_timer = setTimeout(highlightSection, 0, 0);
}

function highlightSection(index) {
    // highlight the index'th div of the table and set a callback for the
    // next one
    document.getElementById(slots[index]).className = "active_slot";
    if (index != 0) {
        document.getElementById(slots[index-1]).className = "passed_slot";
    }
    
    // still have sections to highlight
    if (index <= 9) {
        current_timer = setTimeout(highlightSection, interval, index + 1);
    } else {
        // end of test do stuff
        document.getElementById("time_up").style.display = "block";
    }
}

function dismissOverlay() {
    document.getElementById("time_up").style.display = "none";
}

function reset() {
    // Called when the Reset button is pressed
    // display confirmation dialog if test is running
    // otherwise just reset
    if (document.getElementById("button_start").style.display == "none" && document.getElementById("p10").className != "active_slot") {
        if (!confirm("Are you sure?")) {
            return;
        }
    }
    // stop any callback timers
    if (current_timer) {
        clearTimeout(current_timer);
    }
    document.getElementById("setup").style.display = "block";
    document.getElementById("controls").style.display = "none";
    document.getElementById("button_start").style.display = "inline";
    document.getElementById("time_up").style.display = "none";
    document.getElementById("timer").style.display = "none";
    // clear out the contents of the timer table

    for (var i = 0; i < slots.length; i++) {
        var s = document.getElementById(slots[i]);
        s.firstElementChild.innerHTML = "";
        s.className = "";
    }
}

function setup() {
    // Called when the Done button is pressed

    duration = document.getElementById("duration").value;
    document.getElementById("setup").style.display = "none"; // once setup is complete hide it until reset is called
    document.getElementById("controls").style.display = "block";
    
    var d = new Date().getTime();
    var then = new Date(d + 1000 * 60 * duration); // should(?) give me the end time for the test? - looks like this works

    var h = then.getHours();
    var m = then.getMinutes();
    var t = fmtTime(h, m);
    h = t[0];
    m = t[1];
    var mer = t[2];

    // Populate the time slots with the correct time
}

function updateClock() {
    // Update the clock at the bottom of the page

    var clock = document.getElementById("clock");
    var t = new Date();
    var h = t.getHours();
    var m = t.getMinutes();
    var t = fmtTime(h, m);
    h = t[0];
    m = t[1];
    var mer = t[2];
    clock.innerHTML = h + "<span>:</span>" + m + " " + mer;
    var c = setTimeout(updateClock, 10000);
}