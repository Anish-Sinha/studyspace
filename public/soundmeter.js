/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

try {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  window.audioContext = new AudioContext();
} catch (e) {
  alert('Web Audio API not supported.');
}

var constraints = window.constraints = {
  audio: true,
  video: false
};

// Meter class that generates a number correlated to audio volume.
// The meter class itself displays nothing, but it makes the
// instantaneous and time-decaying volumes available for inspection.
// It also reports on the fraction of samples that were at or near
// the top of the measurement range.
function SoundMeter(context) {
  this.context = context;
  this.instant = 0.0;
  this.script = context.createScriptProcessor(2048, 1, 1);
  this.loud = false;
  this.loudDetected = false;
  var that = this;

  this.script.onaudioprocess = function(event) {
    var input = event.inputBuffer.getChannelData(0);
    var i;
    var sum = 0.0;

    for (i = 0; i < input.length; ++i) {
      sum += input[i] * input[i];
    }

    that.instant = Math.sqrt(sum / input.length);

    if (that.instant.toFixed(3) > 0.02) {
      that.loudDetected = true;
    }
  };
}

SoundMeter.prototype.connectToSource = function(stream, callback) {
  //console.log('SoundMeter connecting');
  try {
    this.mic = this.context.createMediaStreamSource(stream);
    this.mic.connect(this.script);
    // necessary to make sample run, but should not be.
    this.script.connect(this.context.destination);
    if (typeof callback !== 'undefined') {
      callback(null);
    }
  } catch (e) {
    console.error(e);
    if (typeof callback !== 'undefined') {
      callback(e);
    }
  }
};

SoundMeter.prototype.stop = function() {
  this.mic.disconnect();
  this.script.disconnect();
};