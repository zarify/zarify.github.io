(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __commonJS = (cb, mod) => function __require2() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // node_modules/jszip/dist/jszip.min.js
  var require_jszip_min = __commonJS({
    "node_modules/jszip/dist/jszip.min.js"(exports, module) {
      !(function(e) {
        if ("object" == typeof exports && "undefined" != typeof module) module.exports = e();
        else if ("function" == typeof define && define.amd) define([], e);
        else {
          ("undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this).JSZip = e();
        }
      })(function() {
        return (function s(a, o, h) {
          function u(r, e2) {
            if (!o[r]) {
              if (!a[r]) {
                var t = "function" == typeof __require && __require;
                if (!e2 && t) return t(r, true);
                if (l) return l(r, true);
                var n = new Error("Cannot find module '" + r + "'");
                throw n.code = "MODULE_NOT_FOUND", n;
              }
              var i = o[r] = { exports: {} };
              a[r][0].call(i.exports, function(e3) {
                var t2 = a[r][1][e3];
                return u(t2 || e3);
              }, i, i.exports, s, a, o, h);
            }
            return o[r].exports;
          }
          for (var l = "function" == typeof __require && __require, e = 0; e < h.length; e++) u(h[e]);
          return u;
        })({ 1: [function(e, t, r) {
          "use strict";
          var d = e("./utils"), c = e("./support"), p = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
          r.encode = function(e2) {
            for (var t2, r2, n, i, s, a, o, h = [], u = 0, l = e2.length, f = l, c2 = "string" !== d.getTypeOf(e2); u < e2.length; ) f = l - u, n = c2 ? (t2 = e2[u++], r2 = u < l ? e2[u++] : 0, u < l ? e2[u++] : 0) : (t2 = e2.charCodeAt(u++), r2 = u < l ? e2.charCodeAt(u++) : 0, u < l ? e2.charCodeAt(u++) : 0), i = t2 >> 2, s = (3 & t2) << 4 | r2 >> 4, a = 1 < f ? (15 & r2) << 2 | n >> 6 : 64, o = 2 < f ? 63 & n : 64, h.push(p.charAt(i) + p.charAt(s) + p.charAt(a) + p.charAt(o));
            return h.join("");
          }, r.decode = function(e2) {
            var t2, r2, n, i, s, a, o = 0, h = 0, u = "data:";
            if (e2.substr(0, u.length) === u) throw new Error("Invalid base64 input, it looks like a data url.");
            var l, f = 3 * (e2 = e2.replace(/[^A-Za-z0-9+/=]/g, "")).length / 4;
            if (e2.charAt(e2.length - 1) === p.charAt(64) && f--, e2.charAt(e2.length - 2) === p.charAt(64) && f--, f % 1 != 0) throw new Error("Invalid base64 input, bad content length.");
            for (l = c.uint8array ? new Uint8Array(0 | f) : new Array(0 | f); o < e2.length; ) t2 = p.indexOf(e2.charAt(o++)) << 2 | (i = p.indexOf(e2.charAt(o++))) >> 4, r2 = (15 & i) << 4 | (s = p.indexOf(e2.charAt(o++))) >> 2, n = (3 & s) << 6 | (a = p.indexOf(e2.charAt(o++))), l[h++] = t2, 64 !== s && (l[h++] = r2), 64 !== a && (l[h++] = n);
            return l;
          };
        }, { "./support": 30, "./utils": 32 }], 2: [function(e, t, r) {
          "use strict";
          var n = e("./external"), i = e("./stream/DataWorker"), s = e("./stream/Crc32Probe"), a = e("./stream/DataLengthProbe");
          function o(e2, t2, r2, n2, i2) {
            this.compressedSize = e2, this.uncompressedSize = t2, this.crc32 = r2, this.compression = n2, this.compressedContent = i2;
          }
          o.prototype = { getContentWorker: function() {
            var e2 = new i(n.Promise.resolve(this.compressedContent)).pipe(this.compression.uncompressWorker()).pipe(new a("data_length")), t2 = this;
            return e2.on("end", function() {
              if (this.streamInfo.data_length !== t2.uncompressedSize) throw new Error("Bug : uncompressed data size mismatch");
            }), e2;
          }, getCompressedWorker: function() {
            return new i(n.Promise.resolve(this.compressedContent)).withStreamInfo("compressedSize", this.compressedSize).withStreamInfo("uncompressedSize", this.uncompressedSize).withStreamInfo("crc32", this.crc32).withStreamInfo("compression", this.compression);
          } }, o.createWorkerFrom = function(e2, t2, r2) {
            return e2.pipe(new s()).pipe(new a("uncompressedSize")).pipe(t2.compressWorker(r2)).pipe(new a("compressedSize")).withStreamInfo("compression", t2);
          }, t.exports = o;
        }, { "./external": 6, "./stream/Crc32Probe": 25, "./stream/DataLengthProbe": 26, "./stream/DataWorker": 27 }], 3: [function(e, t, r) {
          "use strict";
          var n = e("./stream/GenericWorker");
          r.STORE = { magic: "\0\0", compressWorker: function() {
            return new n("STORE compression");
          }, uncompressWorker: function() {
            return new n("STORE decompression");
          } }, r.DEFLATE = e("./flate");
        }, { "./flate": 7, "./stream/GenericWorker": 28 }], 4: [function(e, t, r) {
          "use strict";
          var n = e("./utils");
          var o = (function() {
            for (var e2, t2 = [], r2 = 0; r2 < 256; r2++) {
              e2 = r2;
              for (var n2 = 0; n2 < 8; n2++) e2 = 1 & e2 ? 3988292384 ^ e2 >>> 1 : e2 >>> 1;
              t2[r2] = e2;
            }
            return t2;
          })();
          t.exports = function(e2, t2) {
            return void 0 !== e2 && e2.length ? "string" !== n.getTypeOf(e2) ? (function(e3, t3, r2, n2) {
              var i = o, s = n2 + r2;
              e3 ^= -1;
              for (var a = n2; a < s; a++) e3 = e3 >>> 8 ^ i[255 & (e3 ^ t3[a])];
              return -1 ^ e3;
            })(0 | t2, e2, e2.length, 0) : (function(e3, t3, r2, n2) {
              var i = o, s = n2 + r2;
              e3 ^= -1;
              for (var a = n2; a < s; a++) e3 = e3 >>> 8 ^ i[255 & (e3 ^ t3.charCodeAt(a))];
              return -1 ^ e3;
            })(0 | t2, e2, e2.length, 0) : 0;
          };
        }, { "./utils": 32 }], 5: [function(e, t, r) {
          "use strict";
          r.base64 = false, r.binary = false, r.dir = false, r.createFolders = true, r.date = null, r.compression = null, r.compressionOptions = null, r.comment = null, r.unixPermissions = null, r.dosPermissions = null;
        }, {}], 6: [function(e, t, r) {
          "use strict";
          var n = null;
          n = "undefined" != typeof Promise ? Promise : e("lie"), t.exports = { Promise: n };
        }, { lie: 37 }], 7: [function(e, t, r) {
          "use strict";
          var n = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Uint32Array, i = e("pako"), s = e("./utils"), a = e("./stream/GenericWorker"), o = n ? "uint8array" : "array";
          function h(e2, t2) {
            a.call(this, "FlateWorker/" + e2), this._pako = null, this._pakoAction = e2, this._pakoOptions = t2, this.meta = {};
          }
          r.magic = "\b\0", s.inherits(h, a), h.prototype.processChunk = function(e2) {
            this.meta = e2.meta, null === this._pako && this._createPako(), this._pako.push(s.transformTo(o, e2.data), false);
          }, h.prototype.flush = function() {
            a.prototype.flush.call(this), null === this._pako && this._createPako(), this._pako.push([], true);
          }, h.prototype.cleanUp = function() {
            a.prototype.cleanUp.call(this), this._pako = null;
          }, h.prototype._createPako = function() {
            this._pako = new i[this._pakoAction]({ raw: true, level: this._pakoOptions.level || -1 });
            var t2 = this;
            this._pako.onData = function(e2) {
              t2.push({ data: e2, meta: t2.meta });
            };
          }, r.compressWorker = function(e2) {
            return new h("Deflate", e2);
          }, r.uncompressWorker = function() {
            return new h("Inflate", {});
          };
        }, { "./stream/GenericWorker": 28, "./utils": 32, pako: 38 }], 8: [function(e, t, r) {
          "use strict";
          function A(e2, t2) {
            var r2, n2 = "";
            for (r2 = 0; r2 < t2; r2++) n2 += String.fromCharCode(255 & e2), e2 >>>= 8;
            return n2;
          }
          function n(e2, t2, r2, n2, i2, s2) {
            var a, o, h = e2.file, u = e2.compression, l = s2 !== O.utf8encode, f = I.transformTo("string", s2(h.name)), c = I.transformTo("string", O.utf8encode(h.name)), d = h.comment, p = I.transformTo("string", s2(d)), m = I.transformTo("string", O.utf8encode(d)), _ = c.length !== h.name.length, g = m.length !== d.length, b = "", v = "", y = "", w = h.dir, k = h.date, x = { crc32: 0, compressedSize: 0, uncompressedSize: 0 };
            t2 && !r2 || (x.crc32 = e2.crc32, x.compressedSize = e2.compressedSize, x.uncompressedSize = e2.uncompressedSize);
            var S = 0;
            t2 && (S |= 8), l || !_ && !g || (S |= 2048);
            var z = 0, C = 0;
            w && (z |= 16), "UNIX" === i2 ? (C = 798, z |= (function(e3, t3) {
              var r3 = e3;
              return e3 || (r3 = t3 ? 16893 : 33204), (65535 & r3) << 16;
            })(h.unixPermissions, w)) : (C = 20, z |= (function(e3) {
              return 63 & (e3 || 0);
            })(h.dosPermissions)), a = k.getUTCHours(), a <<= 6, a |= k.getUTCMinutes(), a <<= 5, a |= k.getUTCSeconds() / 2, o = k.getUTCFullYear() - 1980, o <<= 4, o |= k.getUTCMonth() + 1, o <<= 5, o |= k.getUTCDate(), _ && (v = A(1, 1) + A(B(f), 4) + c, b += "up" + A(v.length, 2) + v), g && (y = A(1, 1) + A(B(p), 4) + m, b += "uc" + A(y.length, 2) + y);
            var E = "";
            return E += "\n\0", E += A(S, 2), E += u.magic, E += A(a, 2), E += A(o, 2), E += A(x.crc32, 4), E += A(x.compressedSize, 4), E += A(x.uncompressedSize, 4), E += A(f.length, 2), E += A(b.length, 2), { fileRecord: R.LOCAL_FILE_HEADER + E + f + b, dirRecord: R.CENTRAL_FILE_HEADER + A(C, 2) + E + A(p.length, 2) + "\0\0\0\0" + A(z, 4) + A(n2, 4) + f + b + p };
          }
          var I = e("../utils"), i = e("../stream/GenericWorker"), O = e("../utf8"), B = e("../crc32"), R = e("../signature");
          function s(e2, t2, r2, n2) {
            i.call(this, "ZipFileWorker"), this.bytesWritten = 0, this.zipComment = t2, this.zipPlatform = r2, this.encodeFileName = n2, this.streamFiles = e2, this.accumulate = false, this.contentBuffer = [], this.dirRecords = [], this.currentSourceOffset = 0, this.entriesCount = 0, this.currentFile = null, this._sources = [];
          }
          I.inherits(s, i), s.prototype.push = function(e2) {
            var t2 = e2.meta.percent || 0, r2 = this.entriesCount, n2 = this._sources.length;
            this.accumulate ? this.contentBuffer.push(e2) : (this.bytesWritten += e2.data.length, i.prototype.push.call(this, { data: e2.data, meta: { currentFile: this.currentFile, percent: r2 ? (t2 + 100 * (r2 - n2 - 1)) / r2 : 100 } }));
          }, s.prototype.openedSource = function(e2) {
            this.currentSourceOffset = this.bytesWritten, this.currentFile = e2.file.name;
            var t2 = this.streamFiles && !e2.file.dir;
            if (t2) {
              var r2 = n(e2, t2, false, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
              this.push({ data: r2.fileRecord, meta: { percent: 0 } });
            } else this.accumulate = true;
          }, s.prototype.closedSource = function(e2) {
            this.accumulate = false;
            var t2 = this.streamFiles && !e2.file.dir, r2 = n(e2, t2, true, this.currentSourceOffset, this.zipPlatform, this.encodeFileName);
            if (this.dirRecords.push(r2.dirRecord), t2) this.push({ data: (function(e3) {
              return R.DATA_DESCRIPTOR + A(e3.crc32, 4) + A(e3.compressedSize, 4) + A(e3.uncompressedSize, 4);
            })(e2), meta: { percent: 100 } });
            else for (this.push({ data: r2.fileRecord, meta: { percent: 0 } }); this.contentBuffer.length; ) this.push(this.contentBuffer.shift());
            this.currentFile = null;
          }, s.prototype.flush = function() {
            for (var e2 = this.bytesWritten, t2 = 0; t2 < this.dirRecords.length; t2++) this.push({ data: this.dirRecords[t2], meta: { percent: 100 } });
            var r2 = this.bytesWritten - e2, n2 = (function(e3, t3, r3, n3, i2) {
              var s2 = I.transformTo("string", i2(n3));
              return R.CENTRAL_DIRECTORY_END + "\0\0\0\0" + A(e3, 2) + A(e3, 2) + A(t3, 4) + A(r3, 4) + A(s2.length, 2) + s2;
            })(this.dirRecords.length, r2, e2, this.zipComment, this.encodeFileName);
            this.push({ data: n2, meta: { percent: 100 } });
          }, s.prototype.prepareNextSource = function() {
            this.previous = this._sources.shift(), this.openedSource(this.previous.streamInfo), this.isPaused ? this.previous.pause() : this.previous.resume();
          }, s.prototype.registerPrevious = function(e2) {
            this._sources.push(e2);
            var t2 = this;
            return e2.on("data", function(e3) {
              t2.processChunk(e3);
            }), e2.on("end", function() {
              t2.closedSource(t2.previous.streamInfo), t2._sources.length ? t2.prepareNextSource() : t2.end();
            }), e2.on("error", function(e3) {
              t2.error(e3);
            }), this;
          }, s.prototype.resume = function() {
            return !!i.prototype.resume.call(this) && (!this.previous && this._sources.length ? (this.prepareNextSource(), true) : this.previous || this._sources.length || this.generatedError ? void 0 : (this.end(), true));
          }, s.prototype.error = function(e2) {
            var t2 = this._sources;
            if (!i.prototype.error.call(this, e2)) return false;
            for (var r2 = 0; r2 < t2.length; r2++) try {
              t2[r2].error(e2);
            } catch (e3) {
            }
            return true;
          }, s.prototype.lock = function() {
            i.prototype.lock.call(this);
            for (var e2 = this._sources, t2 = 0; t2 < e2.length; t2++) e2[t2].lock();
          }, t.exports = s;
        }, { "../crc32": 4, "../signature": 23, "../stream/GenericWorker": 28, "../utf8": 31, "../utils": 32 }], 9: [function(e, t, r) {
          "use strict";
          var u = e("../compressions"), n = e("./ZipFileWorker");
          r.generateWorker = function(e2, a, t2) {
            var o = new n(a.streamFiles, t2, a.platform, a.encodeFileName), h = 0;
            try {
              e2.forEach(function(e3, t3) {
                h++;
                var r2 = (function(e4, t4) {
                  var r3 = e4 || t4, n3 = u[r3];
                  if (!n3) throw new Error(r3 + " is not a valid compression method !");
                  return n3;
                })(t3.options.compression, a.compression), n2 = t3.options.compressionOptions || a.compressionOptions || {}, i = t3.dir, s = t3.date;
                t3._compressWorker(r2, n2).withStreamInfo("file", { name: e3, dir: i, date: s, comment: t3.comment || "", unixPermissions: t3.unixPermissions, dosPermissions: t3.dosPermissions }).pipe(o);
              }), o.entriesCount = h;
            } catch (e3) {
              o.error(e3);
            }
            return o;
          };
        }, { "../compressions": 3, "./ZipFileWorker": 8 }], 10: [function(e, t, r) {
          "use strict";
          function n() {
            if (!(this instanceof n)) return new n();
            if (arguments.length) throw new Error("The constructor with parameters has been removed in JSZip 3.0, please check the upgrade guide.");
            this.files = /* @__PURE__ */ Object.create(null), this.comment = null, this.root = "", this.clone = function() {
              var e2 = new n();
              for (var t2 in this) "function" != typeof this[t2] && (e2[t2] = this[t2]);
              return e2;
            };
          }
          (n.prototype = e("./object")).loadAsync = e("./load"), n.support = e("./support"), n.defaults = e("./defaults"), n.version = "3.10.2", n.loadAsync = function(e2, t2) {
            return new n().loadAsync(e2, t2);
          }, n.external = e("./external"), t.exports = n;
        }, { "./defaults": 5, "./external": 6, "./load": 11, "./object": 15, "./support": 30 }], 11: [function(e, t, r) {
          "use strict";
          var u = e("./utils"), i = e("./external"), n = e("./utf8"), s = e("./zipEntries"), a = e("./stream/Crc32Probe"), l = e("./nodejsUtils");
          function f(n2) {
            return new i.Promise(function(e2, t2) {
              var r2 = n2.decompressed.getContentWorker().pipe(new a());
              r2.on("error", function(e3) {
                t2(e3);
              }).on("end", function() {
                r2.streamInfo.crc32 !== n2.decompressed.crc32 ? t2(new Error("Corrupted zip : CRC32 mismatch")) : e2();
              }).resume();
            });
          }
          t.exports = function(e2, o) {
            var h = this;
            return o = u.extend(o || {}, { base64: false, checkCRC32: false, optimizedBinaryString: false, createFolders: false, decodeFileName: n.utf8decode }), l.isNode && l.isStream(e2) ? i.Promise.reject(new Error("JSZip can't accept a stream when loading a zip file.")) : u.prepareContent("the loaded zip file", e2, true, o.optimizedBinaryString, o.base64).then(function(e3) {
              var t2 = new s(o);
              return t2.load(e3), t2;
            }).then(function(e3) {
              var t2 = [i.Promise.resolve(e3)], r2 = e3.files;
              if (o.checkCRC32) for (var n2 = 0; n2 < r2.length; n2++) t2.push(f(r2[n2]));
              return i.Promise.all(t2);
            }).then(function(e3) {
              for (var t2 = e3.shift(), r2 = t2.files, n2 = 0; n2 < r2.length; n2++) {
                var i2 = r2[n2], s2 = i2.fileNameStr, a2 = u.resolve(i2.fileNameStr);
                h.file(a2, i2.decompressed, { binary: true, optimizedBinaryString: true, date: i2.date, dir: i2.dir, comment: i2.fileCommentStr.length ? i2.fileCommentStr : null, unixPermissions: i2.unixPermissions, dosPermissions: i2.dosPermissions, createFolders: o.createFolders }), i2.dir || (h.file(a2).unsafeOriginalName = s2);
              }
              return t2.zipComment.length && (h.comment = t2.zipComment), h;
            });
          };
        }, { "./external": 6, "./nodejsUtils": 14, "./stream/Crc32Probe": 25, "./utf8": 31, "./utils": 32, "./zipEntries": 33 }], 12: [function(e, t, r) {
          "use strict";
          var n = e("../utils"), i = e("../stream/GenericWorker");
          function s(e2, t2) {
            i.call(this, "Nodejs stream input adapter for " + e2), this._upstreamEnded = false, this._bindStream(t2);
          }
          n.inherits(s, i), s.prototype._bindStream = function(e2) {
            var t2 = this;
            (this._stream = e2).pause(), e2.on("data", function(e3) {
              t2.push({ data: e3, meta: { percent: 0 } });
            }).on("error", function(e3) {
              t2.isPaused ? this.generatedError = e3 : t2.error(e3);
            }).on("end", function() {
              t2.isPaused ? t2._upstreamEnded = true : t2.end();
            });
          }, s.prototype.pause = function() {
            return !!i.prototype.pause.call(this) && (this._stream.pause(), true);
          }, s.prototype.resume = function() {
            return !!i.prototype.resume.call(this) && (this._upstreamEnded ? this.end() : this._stream.resume(), true);
          }, t.exports = s;
        }, { "../stream/GenericWorker": 28, "../utils": 32 }], 13: [function(e, t, r) {
          "use strict";
          var i = e("readable-stream").Readable;
          function n(e2, t2, r2) {
            i.call(this, t2), this._helper = e2;
            var n2 = this;
            e2.on("data", function(e3, t3) {
              n2.push(e3) || n2._helper.pause(), r2 && r2(t3);
            }).on("error", function(e3) {
              n2.emit("error", e3);
            }).on("end", function() {
              n2.push(null);
            });
          }
          e("../utils").inherits(n, i), n.prototype._read = function() {
            this._helper.resume();
          }, t.exports = n;
        }, { "../utils": 32, "readable-stream": 16 }], 14: [function(e, t, r) {
          "use strict";
          t.exports = { isNode: "undefined" != typeof Buffer, newBufferFrom: function(e2, t2) {
            if (Buffer.from && Buffer.from !== Uint8Array.from) return Buffer.from(e2, t2);
            if ("number" == typeof e2) throw new Error('The "data" argument must not be a number');
            return new Buffer(e2, t2);
          }, allocBuffer: function(e2) {
            if (Buffer.alloc) return Buffer.alloc(e2);
            var t2 = new Buffer(e2);
            return t2.fill(0), t2;
          }, isBuffer: function(e2) {
            return Buffer.isBuffer(e2);
          }, isStream: function(e2) {
            return e2 && "function" == typeof e2.on && "function" == typeof e2.pause && "function" == typeof e2.resume;
          } };
        }, {}], 15: [function(e, t, r) {
          "use strict";
          function s(e2, t2, r2) {
            var n2, i2 = u.getTypeOf(t2), s2 = u.extend(r2 || {}, f);
            s2.date = s2.date || /* @__PURE__ */ new Date(), null !== s2.compression && (s2.compression = s2.compression.toUpperCase()), "string" == typeof s2.unixPermissions && (s2.unixPermissions = parseInt(s2.unixPermissions, 8)), s2.unixPermissions && 16384 & s2.unixPermissions && (s2.dir = true), s2.dosPermissions && 16 & s2.dosPermissions && (s2.dir = true), s2.dir && (e2 = g(e2)), s2.createFolders && (n2 = _(e2)) && b.call(this, n2, true);
            var a2 = "string" === i2 && false === s2.binary && false === s2.base64;
            r2 && void 0 !== r2.binary || (s2.binary = !a2), (t2 instanceof c && 0 === t2.uncompressedSize || s2.dir || !t2 || 0 === t2.length) && (s2.base64 = false, s2.binary = true, t2 = "", s2.compression = "STORE", i2 = "string");
            var o2 = null;
            o2 = t2 instanceof c || t2 instanceof l ? t2 : p.isNode && p.isStream(t2) ? new m(e2, t2) : u.prepareContent(e2, t2, s2.binary, s2.optimizedBinaryString, s2.base64);
            var h2 = new d(e2, o2, s2);
            this.files[e2] = h2;
          }
          var i = e("./utf8"), u = e("./utils"), l = e("./stream/GenericWorker"), a = e("./stream/StreamHelper"), f = e("./defaults"), c = e("./compressedObject"), d = e("./zipObject"), o = e("./generate"), p = e("./nodejsUtils"), m = e("./nodejs/NodejsStreamInputAdapter"), _ = function(e2) {
            "/" === e2.slice(-1) && (e2 = e2.substring(0, e2.length - 1));
            var t2 = e2.lastIndexOf("/");
            return 0 < t2 ? e2.substring(0, t2) : "";
          }, g = function(e2) {
            return "/" !== e2.slice(-1) && (e2 += "/"), e2;
          }, b = function(e2, t2) {
            return t2 = void 0 !== t2 ? t2 : f.createFolders, e2 = g(e2), this.files[e2] || s.call(this, e2, null, { dir: true, createFolders: t2 }), this.files[e2];
          };
          function h(e2) {
            return "[object RegExp]" === Object.prototype.toString.call(e2);
          }
          var n = { load: function() {
            throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
          }, forEach: function(e2) {
            var t2, r2, n2;
            for (t2 in this.files) n2 = this.files[t2], (r2 = t2.slice(this.root.length, t2.length)) && t2.slice(0, this.root.length) === this.root && e2(r2, n2);
          }, filter: function(r2) {
            var n2 = [];
            return this.forEach(function(e2, t2) {
              r2(e2, t2) && n2.push(t2);
            }), n2;
          }, file: function(e2, t2, r2) {
            if (1 !== arguments.length) return e2 = this.root + e2, s.call(this, e2, t2, r2), this;
            if (h(e2)) {
              var n2 = e2;
              return this.filter(function(e3, t3) {
                return !t3.dir && n2.test(e3);
              });
            }
            var i2 = this.files[this.root + e2];
            return i2 && !i2.dir ? i2 : null;
          }, folder: function(r2) {
            if (!r2) return this;
            if (h(r2)) return this.filter(function(e3, t3) {
              return t3.dir && r2.test(e3);
            });
            var e2 = this.root + r2, t2 = b.call(this, e2), n2 = this.clone();
            return n2.root = t2.name, n2;
          }, remove: function(r2) {
            r2 = this.root + r2;
            var e2 = this.files[r2];
            if (e2 || ("/" !== r2.slice(-1) && (r2 += "/"), e2 = this.files[r2]), e2 && !e2.dir) delete this.files[r2];
            else for (var t2 = this.filter(function(e3, t3) {
              return t3.name.slice(0, r2.length) === r2;
            }), n2 = 0; n2 < t2.length; n2++) delete this.files[t2[n2].name];
            return this;
          }, generate: function() {
            throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
          }, generateInternalStream: function(e2) {
            var t2, r2 = {};
            try {
              if ((r2 = u.extend(e2 || {}, { streamFiles: false, compression: "STORE", compressionOptions: null, type: "", platform: "DOS", comment: null, mimeType: "application/zip", encodeFileName: i.utf8encode })).type = r2.type.toLowerCase(), r2.compression = r2.compression.toUpperCase(), "binarystring" === r2.type && (r2.type = "string"), !r2.type) throw new Error("No output type specified.");
              u.checkSupport(r2.type), "darwin" !== r2.platform && "freebsd" !== r2.platform && "linux" !== r2.platform && "sunos" !== r2.platform || (r2.platform = "UNIX"), "win32" === r2.platform && (r2.platform = "DOS");
              var n2 = r2.comment || this.comment || "";
              t2 = o.generateWorker(this, r2, n2);
            } catch (e3) {
              (t2 = new l("error")).error(e3);
            }
            return new a(t2, r2.type || "string", r2.mimeType);
          }, generateAsync: function(e2, t2) {
            return this.generateInternalStream(e2).accumulate(t2);
          }, generateNodeStream: function(e2, t2) {
            return (e2 = e2 || {}).type || (e2.type = "nodebuffer"), this.generateInternalStream(e2).toNodejsStream(t2);
          } };
          t.exports = n;
        }, { "./compressedObject": 2, "./defaults": 5, "./generate": 9, "./nodejs/NodejsStreamInputAdapter": 12, "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31, "./utils": 32, "./zipObject": 35 }], 16: [function(e, t, r) {
          "use strict";
          t.exports = e("stream");
        }, { stream: void 0 }], 17: [function(e, t, r) {
          "use strict";
          var n = e("./DataReader");
          function i(e2) {
            n.call(this, e2);
            for (var t2 = 0; t2 < this.data.length; t2++) e2[t2] = 255 & e2[t2];
          }
          e("../utils").inherits(i, n), i.prototype.byteAt = function(e2) {
            return this.data[this.zero + e2];
          }, i.prototype.lastIndexOfSignature = function(e2) {
            for (var t2 = e2.charCodeAt(0), r2 = e2.charCodeAt(1), n2 = e2.charCodeAt(2), i2 = e2.charCodeAt(3), s = this.length - 4; 0 <= s; --s) if (this.data[s] === t2 && this.data[s + 1] === r2 && this.data[s + 2] === n2 && this.data[s + 3] === i2) return s - this.zero;
            return -1;
          }, i.prototype.readAndCheckSignature = function(e2) {
            var t2 = e2.charCodeAt(0), r2 = e2.charCodeAt(1), n2 = e2.charCodeAt(2), i2 = e2.charCodeAt(3), s = this.readData(4);
            return t2 === s[0] && r2 === s[1] && n2 === s[2] && i2 === s[3];
          }, i.prototype.readData = function(e2) {
            if (this.checkOffset(e2), 0 === e2) return [];
            var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
            return this.index += e2, t2;
          }, t.exports = i;
        }, { "../utils": 32, "./DataReader": 18 }], 18: [function(e, t, r) {
          "use strict";
          var n = e("../utils");
          function i(e2) {
            this.data = e2, this.length = e2.length, this.index = 0, this.zero = 0;
          }
          i.prototype = { checkOffset: function(e2) {
            this.checkIndex(this.index + e2);
          }, checkIndex: function(e2) {
            if (this.length < this.zero + e2 || e2 < 0) throw new Error("End of data reached (data length = " + this.length + ", asked index = " + e2 + "). Corrupted zip ?");
          }, setIndex: function(e2) {
            this.checkIndex(e2), this.index = e2;
          }, skip: function(e2) {
            this.setIndex(this.index + e2);
          }, byteAt: function() {
          }, readInt: function(e2) {
            var t2, r2 = 0;
            for (this.checkOffset(e2), t2 = this.index + e2 - 1; t2 >= this.index; t2--) r2 = (r2 << 8) + this.byteAt(t2);
            return this.index += e2, r2;
          }, readString: function(e2) {
            return n.transformTo("string", this.readData(e2));
          }, readData: function() {
          }, lastIndexOfSignature: function() {
          }, readAndCheckSignature: function() {
          }, readDate: function() {
            var e2 = this.readInt(4);
            return new Date(Date.UTC(1980 + (e2 >> 25 & 127), (e2 >> 21 & 15) - 1, e2 >> 16 & 31, e2 >> 11 & 31, e2 >> 5 & 63, (31 & e2) << 1));
          } }, t.exports = i;
        }, { "../utils": 32 }], 19: [function(e, t, r) {
          "use strict";
          var n = e("./Uint8ArrayReader");
          function i(e2) {
            n.call(this, e2);
          }
          e("../utils").inherits(i, n), i.prototype.readData = function(e2) {
            this.checkOffset(e2);
            var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
            return this.index += e2, t2;
          }, t.exports = i;
        }, { "../utils": 32, "./Uint8ArrayReader": 21 }], 20: [function(e, t, r) {
          "use strict";
          var n = e("./DataReader");
          function i(e2) {
            n.call(this, e2);
          }
          e("../utils").inherits(i, n), i.prototype.byteAt = function(e2) {
            return this.data.charCodeAt(this.zero + e2);
          }, i.prototype.lastIndexOfSignature = function(e2) {
            return this.data.lastIndexOf(e2) - this.zero;
          }, i.prototype.readAndCheckSignature = function(e2) {
            return e2 === this.readData(4);
          }, i.prototype.readData = function(e2) {
            this.checkOffset(e2);
            var t2 = this.data.slice(this.zero + this.index, this.zero + this.index + e2);
            return this.index += e2, t2;
          }, t.exports = i;
        }, { "../utils": 32, "./DataReader": 18 }], 21: [function(e, t, r) {
          "use strict";
          var n = e("./ArrayReader");
          function i(e2) {
            n.call(this, e2);
          }
          e("../utils").inherits(i, n), i.prototype.readData = function(e2) {
            if (this.checkOffset(e2), 0 === e2) return new Uint8Array(0);
            var t2 = this.data.subarray(this.zero + this.index, this.zero + this.index + e2);
            return this.index += e2, t2;
          }, t.exports = i;
        }, { "../utils": 32, "./ArrayReader": 17 }], 22: [function(e, t, r) {
          "use strict";
          var n = e("../utils"), i = e("../support"), s = e("./ArrayReader"), a = e("./StringReader"), o = e("./NodeBufferReader"), h = e("./Uint8ArrayReader");
          t.exports = function(e2) {
            var t2 = n.getTypeOf(e2);
            return n.checkSupport(t2), "string" !== t2 || i.uint8array ? "nodebuffer" === t2 ? new o(e2) : i.uint8array ? new h(n.transformTo("uint8array", e2)) : new s(n.transformTo("array", e2)) : new a(e2);
          };
        }, { "../support": 30, "../utils": 32, "./ArrayReader": 17, "./NodeBufferReader": 19, "./StringReader": 20, "./Uint8ArrayReader": 21 }], 23: [function(e, t, r) {
          "use strict";
          r.LOCAL_FILE_HEADER = "PK", r.CENTRAL_FILE_HEADER = "PK", r.CENTRAL_DIRECTORY_END = "PK", r.ZIP64_CENTRAL_DIRECTORY_LOCATOR = "PK\x07", r.ZIP64_CENTRAL_DIRECTORY_END = "PK", r.DATA_DESCRIPTOR = "PK\x07\b";
        }, {}], 24: [function(e, t, r) {
          "use strict";
          var n = e("./GenericWorker"), i = e("../utils");
          function s(e2) {
            n.call(this, "ConvertWorker to " + e2), this.destType = e2;
          }
          i.inherits(s, n), s.prototype.processChunk = function(e2) {
            this.push({ data: i.transformTo(this.destType, e2.data), meta: e2.meta });
          }, t.exports = s;
        }, { "../utils": 32, "./GenericWorker": 28 }], 25: [function(e, t, r) {
          "use strict";
          var n = e("./GenericWorker"), i = e("../crc32");
          function s() {
            n.call(this, "Crc32Probe"), this.withStreamInfo("crc32", 0);
          }
          e("../utils").inherits(s, n), s.prototype.processChunk = function(e2) {
            this.streamInfo.crc32 = i(e2.data, this.streamInfo.crc32 || 0), this.push(e2);
          }, t.exports = s;
        }, { "../crc32": 4, "../utils": 32, "./GenericWorker": 28 }], 26: [function(e, t, r) {
          "use strict";
          var n = e("../utils"), i = e("./GenericWorker");
          function s(e2) {
            i.call(this, "DataLengthProbe for " + e2), this.propName = e2, this.withStreamInfo(e2, 0);
          }
          n.inherits(s, i), s.prototype.processChunk = function(e2) {
            if (e2) {
              var t2 = this.streamInfo[this.propName] || 0;
              this.streamInfo[this.propName] = t2 + e2.data.length;
            }
            i.prototype.processChunk.call(this, e2);
          }, t.exports = s;
        }, { "../utils": 32, "./GenericWorker": 28 }], 27: [function(e, t, r) {
          "use strict";
          var n = e("../utils"), i = e("./GenericWorker");
          function s(e2) {
            i.call(this, "DataWorker");
            var t2 = this;
            this.dataIsReady = false, this.index = 0, this.max = 0, this.data = null, this.type = "", this._tickScheduled = false, e2.then(function(e3) {
              t2.dataIsReady = true, t2.data = e3, t2.max = e3 && e3.length || 0, t2.type = n.getTypeOf(e3), t2.isPaused || t2._tickAndRepeat();
            }, function(e3) {
              t2.error(e3);
            });
          }
          n.inherits(s, i), s.prototype.cleanUp = function() {
            i.prototype.cleanUp.call(this), this.data = null;
          }, s.prototype.resume = function() {
            return !!i.prototype.resume.call(this) && (!this._tickScheduled && this.dataIsReady && (this._tickScheduled = true, n.delay(this._tickAndRepeat, [], this)), true);
          }, s.prototype._tickAndRepeat = function() {
            this._tickScheduled = false, this.isPaused || this.isFinished || (this._tick(), this.isFinished || (n.delay(this._tickAndRepeat, [], this), this._tickScheduled = true));
          }, s.prototype._tick = function() {
            if (this.isPaused || this.isFinished) return false;
            var e2 = null, t2 = Math.min(this.max, this.index + 16384);
            if (this.index >= this.max) return this.end();
            switch (this.type) {
              case "string":
                e2 = this.data.substring(this.index, t2);
                break;
              case "uint8array":
                e2 = this.data.subarray(this.index, t2);
                break;
              case "array":
              case "nodebuffer":
                e2 = this.data.slice(this.index, t2);
            }
            return this.index = t2, this.push({ data: e2, meta: { percent: this.max ? this.index / this.max * 100 : 0 } });
          }, t.exports = s;
        }, { "../utils": 32, "./GenericWorker": 28 }], 28: [function(e, t, r) {
          "use strict";
          function n(e2) {
            this.name = e2 || "default", this.streamInfo = {}, this.generatedError = null, this.extraStreamInfo = {}, this.isPaused = true, this.isFinished = false, this.isLocked = false, this._listeners = { data: [], end: [], error: [] }, this.previous = null;
          }
          n.prototype = { push: function(e2) {
            this.emit("data", e2);
          }, end: function() {
            if (this.isFinished) return false;
            this.flush();
            try {
              this.emit("end"), this.cleanUp(), this.isFinished = true;
            } catch (e2) {
              this.emit("error", e2);
            }
            return true;
          }, error: function(e2) {
            return !this.isFinished && (this.isPaused ? this.generatedError = e2 : (this.isFinished = true, this.emit("error", e2), this.previous && this.previous.error(e2), this.cleanUp()), true);
          }, on: function(e2, t2) {
            return this._listeners[e2].push(t2), this;
          }, cleanUp: function() {
            this.streamInfo = this.generatedError = this.extraStreamInfo = null, this._listeners = [];
          }, emit: function(e2, t2) {
            if (this._listeners[e2]) for (var r2 = 0; r2 < this._listeners[e2].length; r2++) this._listeners[e2][r2].call(this, t2);
          }, pipe: function(e2) {
            return e2.registerPrevious(this);
          }, registerPrevious: function(e2) {
            if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
            this.streamInfo = e2.streamInfo, this.mergeStreamInfo(), this.previous = e2;
            var t2 = this;
            return e2.on("data", function(e3) {
              t2.processChunk(e3);
            }), e2.on("end", function() {
              t2.end();
            }), e2.on("error", function(e3) {
              t2.error(e3);
            }), this;
          }, pause: function() {
            return !this.isPaused && !this.isFinished && (this.isPaused = true, this.previous && this.previous.pause(), true);
          }, resume: function() {
            if (!this.isPaused || this.isFinished) return false;
            var e2 = this.isPaused = false;
            return this.generatedError && (this.error(this.generatedError), e2 = true), this.previous && this.previous.resume(), !e2;
          }, flush: function() {
          }, processChunk: function(e2) {
            this.push(e2);
          }, withStreamInfo: function(e2, t2) {
            return this.extraStreamInfo[e2] = t2, this.mergeStreamInfo(), this;
          }, mergeStreamInfo: function() {
            for (var e2 in this.extraStreamInfo) Object.prototype.hasOwnProperty.call(this.extraStreamInfo, e2) && (this.streamInfo[e2] = this.extraStreamInfo[e2]);
          }, lock: function() {
            if (this.isLocked) throw new Error("The stream '" + this + "' has already been used.");
            this.isLocked = true, this.previous && this.previous.lock();
          }, toString: function() {
            var e2 = "Worker " + this.name;
            return this.previous ? this.previous + " -> " + e2 : e2;
          } }, t.exports = n;
        }, {}], 29: [function(e, t, r) {
          "use strict";
          var h = e("../utils"), i = e("./ConvertWorker"), s = e("./GenericWorker"), u = e("../base64"), n = e("../support"), a = e("../external"), o = null;
          if (n.nodestream) try {
            o = e("../nodejs/NodejsStreamOutputAdapter");
          } catch (e2) {
          }
          function l(e2, o2) {
            return new a.Promise(function(t2, r2) {
              var n2 = [], i2 = e2._internalType, s2 = e2._outputType, a2 = e2._mimeType;
              e2.on("data", function(e3, t3) {
                n2.push(e3), o2 && o2(t3);
              }).on("error", function(e3) {
                n2 = [], r2(e3);
              }).on("end", function() {
                try {
                  var e3 = (function(e4, t3, r3) {
                    switch (e4) {
                      case "blob":
                        return h.newBlob(h.transformTo("arraybuffer", t3), r3);
                      case "base64":
                        return u.encode(t3);
                      default:
                        return h.transformTo(e4, t3);
                    }
                  })(s2, (function(e4, t3) {
                    var r3, n3 = 0, i3 = null, s3 = 0;
                    for (r3 = 0; r3 < t3.length; r3++) s3 += t3[r3].length;
                    switch (e4) {
                      case "string":
                        return t3.join("");
                      case "array":
                        return Array.prototype.concat.apply([], t3);
                      case "uint8array":
                        for (i3 = new Uint8Array(s3), r3 = 0; r3 < t3.length; r3++) i3.set(t3[r3], n3), n3 += t3[r3].length;
                        return i3;
                      case "nodebuffer":
                        return Buffer.concat(t3);
                      default:
                        throw new Error("concat : unsupported type '" + e4 + "'");
                    }
                  })(i2, n2), a2);
                  t2(e3);
                } catch (e4) {
                  r2(e4);
                }
                n2 = [];
              }).resume();
            });
          }
          function f(e2, t2, r2) {
            var n2 = t2;
            switch (t2) {
              case "blob":
              case "arraybuffer":
                n2 = "uint8array";
                break;
              case "base64":
                n2 = "string";
            }
            try {
              this._internalType = n2, this._outputType = t2, this._mimeType = r2, h.checkSupport(n2), this._worker = e2.pipe(new i(n2)), e2.lock();
            } catch (e3) {
              this._worker = new s("error"), this._worker.error(e3);
            }
          }
          f.prototype = { accumulate: function(e2) {
            return l(this, e2);
          }, on: function(e2, t2) {
            var r2 = this;
            return "data" === e2 ? this._worker.on(e2, function(e3) {
              t2.call(r2, e3.data, e3.meta);
            }) : this._worker.on(e2, function() {
              h.delay(t2, arguments, r2);
            }), this;
          }, resume: function() {
            return h.delay(this._worker.resume, [], this._worker), this;
          }, pause: function() {
            return this._worker.pause(), this;
          }, toNodejsStream: function(e2) {
            if (h.checkSupport("nodestream"), "nodebuffer" !== this._outputType) throw new Error(this._outputType + " is not supported by this method");
            return new o(this, { objectMode: "nodebuffer" !== this._outputType }, e2);
          } }, t.exports = f;
        }, { "../base64": 1, "../external": 6, "../nodejs/NodejsStreamOutputAdapter": 13, "../support": 30, "../utils": 32, "./ConvertWorker": 24, "./GenericWorker": 28 }], 30: [function(e, t, r) {
          "use strict";
          if (r.base64 = true, r.array = true, r.string = true, r.arraybuffer = "undefined" != typeof ArrayBuffer && "undefined" != typeof Uint8Array, r.nodebuffer = "undefined" != typeof Buffer, r.uint8array = "undefined" != typeof Uint8Array, "undefined" == typeof ArrayBuffer) r.blob = false;
          else {
            var n = new ArrayBuffer(0);
            try {
              r.blob = 0 === new Blob([n], { type: "application/zip" }).size;
            } catch (e2) {
              try {
                var i = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
                i.append(n), r.blob = 0 === i.getBlob("application/zip").size;
              } catch (e3) {
                r.blob = false;
              }
            }
          }
          try {
            r.nodestream = !!e("readable-stream").Readable;
          } catch (e2) {
            r.nodestream = false;
          }
        }, { "readable-stream": 16 }], 31: [function(e, t, s) {
          "use strict";
          for (var o = e("./utils"), h = e("./support"), r = e("./nodejsUtils"), n = e("./stream/GenericWorker"), u = new Array(256), i = 0; i < 256; i++) u[i] = 252 <= i ? 6 : 248 <= i ? 5 : 240 <= i ? 4 : 224 <= i ? 3 : 192 <= i ? 2 : 1;
          u[254] = u[254] = 1;
          function a() {
            n.call(this, "utf-8 decode"), this.leftOver = null;
          }
          function l() {
            n.call(this, "utf-8 encode");
          }
          s.utf8encode = function(e2) {
            return h.nodebuffer ? r.newBufferFrom(e2, "utf-8") : (function(e3) {
              var t2, r2, n2, i2, s2, a2 = e3.length, o2 = 0;
              for (i2 = 0; i2 < a2; i2++) 55296 == (64512 & (r2 = e3.charCodeAt(i2))) && i2 + 1 < a2 && 56320 == (64512 & (n2 = e3.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), o2 += r2 < 128 ? 1 : r2 < 2048 ? 2 : r2 < 65536 ? 3 : 4;
              for (t2 = h.uint8array ? new Uint8Array(o2) : new Array(o2), i2 = s2 = 0; s2 < o2; i2++) 55296 == (64512 & (r2 = e3.charCodeAt(i2))) && i2 + 1 < a2 && 56320 == (64512 & (n2 = e3.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), r2 < 128 ? t2[s2++] = r2 : (r2 < 2048 ? t2[s2++] = 192 | r2 >>> 6 : (r2 < 65536 ? t2[s2++] = 224 | r2 >>> 12 : (t2[s2++] = 240 | r2 >>> 18, t2[s2++] = 128 | r2 >>> 12 & 63), t2[s2++] = 128 | r2 >>> 6 & 63), t2[s2++] = 128 | 63 & r2);
              return t2;
            })(e2);
          }, s.utf8decode = function(e2) {
            return h.nodebuffer ? o.transformTo("nodebuffer", e2).toString("utf-8") : (function(e3) {
              var t2, r2, n2, i2, s2 = e3.length, a2 = new Array(2 * s2);
              for (t2 = r2 = 0; t2 < s2; ) if ((n2 = e3[t2++]) < 128) a2[r2++] = n2;
              else if (4 < (i2 = u[n2])) a2[r2++] = 65533, t2 += i2 - 1;
              else {
                for (n2 &= 2 === i2 ? 31 : 3 === i2 ? 15 : 7; 1 < i2 && t2 < s2; ) n2 = n2 << 6 | 63 & e3[t2++], i2--;
                1 < i2 ? a2[r2++] = 65533 : n2 < 65536 ? a2[r2++] = n2 : (n2 -= 65536, a2[r2++] = 55296 | n2 >> 10 & 1023, a2[r2++] = 56320 | 1023 & n2);
              }
              return a2.length !== r2 && (a2.subarray ? a2 = a2.subarray(0, r2) : a2.length = r2), o.applyFromCharCode(a2);
            })(e2 = o.transformTo(h.uint8array ? "uint8array" : "array", e2));
          }, o.inherits(a, n), a.prototype.processChunk = function(e2) {
            var t2 = o.transformTo(h.uint8array ? "uint8array" : "array", e2.data);
            if (this.leftOver && this.leftOver.length) {
              if (h.uint8array) {
                var r2 = t2;
                (t2 = new Uint8Array(r2.length + this.leftOver.length)).set(this.leftOver, 0), t2.set(r2, this.leftOver.length);
              } else t2 = this.leftOver.concat(t2);
              this.leftOver = null;
            }
            var n2 = (function(e3, t3) {
              var r3;
              for ((t3 = t3 || e3.length) > e3.length && (t3 = e3.length), r3 = t3 - 1; 0 <= r3 && 128 == (192 & e3[r3]); ) r3--;
              return r3 < 0 ? t3 : 0 === r3 ? t3 : r3 + u[e3[r3]] > t3 ? r3 : t3;
            })(t2), i2 = t2;
            n2 !== t2.length && (h.uint8array ? (i2 = t2.subarray(0, n2), this.leftOver = t2.subarray(n2, t2.length)) : (i2 = t2.slice(0, n2), this.leftOver = t2.slice(n2, t2.length))), this.push({ data: s.utf8decode(i2), meta: e2.meta });
          }, a.prototype.flush = function() {
            this.leftOver && this.leftOver.length && (this.push({ data: s.utf8decode(this.leftOver), meta: {} }), this.leftOver = null);
          }, s.Utf8DecodeWorker = a, o.inherits(l, n), l.prototype.processChunk = function(e2) {
            this.push({ data: s.utf8encode(e2.data), meta: e2.meta });
          }, s.Utf8EncodeWorker = l;
        }, { "./nodejsUtils": 14, "./stream/GenericWorker": 28, "./support": 30, "./utils": 32 }], 32: [function(e, t, a) {
          "use strict";
          var o = e("./support"), h = e("./base64"), r = e("./nodejsUtils"), u = e("./external");
          function n(e2) {
            return e2;
          }
          function l(e2, t2) {
            for (var r2 = 0; r2 < e2.length; ++r2) t2[r2] = 255 & e2.charCodeAt(r2);
            return t2;
          }
          e("setimmediate"), a.newBlob = function(t2, r2) {
            a.checkSupport("blob");
            try {
              return new Blob([t2], { type: r2 });
            } catch (e2) {
              try {
                var n2 = new (self.BlobBuilder || self.WebKitBlobBuilder || self.MozBlobBuilder || self.MSBlobBuilder)();
                return n2.append(t2), n2.getBlob(r2);
              } catch (e3) {
                throw new Error("Bug : can't construct the Blob.");
              }
            }
          };
          var i = { stringifyByChunk: function(e2, t2, r2) {
            var n2 = [], i2 = 0, s2 = e2.length;
            if (s2 <= r2) return String.fromCharCode.apply(null, e2);
            for (; i2 < s2; ) "array" === t2 || "nodebuffer" === t2 ? n2.push(String.fromCharCode.apply(null, e2.slice(i2, Math.min(i2 + r2, s2)))) : n2.push(String.fromCharCode.apply(null, e2.subarray(i2, Math.min(i2 + r2, s2)))), i2 += r2;
            return n2.join("");
          }, stringifyByChar: function(e2) {
            for (var t2 = "", r2 = 0; r2 < e2.length; r2++) t2 += String.fromCharCode(e2[r2]);
            return t2;
          }, applyCanBeUsed: { uint8array: (function() {
            try {
              return o.uint8array && 1 === String.fromCharCode.apply(null, new Uint8Array(1)).length;
            } catch (e2) {
              return false;
            }
          })(), nodebuffer: (function() {
            try {
              return o.nodebuffer && 1 === String.fromCharCode.apply(null, r.allocBuffer(1)).length;
            } catch (e2) {
              return false;
            }
          })() } };
          function s(e2) {
            var t2 = 65536, r2 = a.getTypeOf(e2), n2 = true;
            if ("uint8array" === r2 ? n2 = i.applyCanBeUsed.uint8array : "nodebuffer" === r2 && (n2 = i.applyCanBeUsed.nodebuffer), n2) for (; 1 < t2; ) try {
              return i.stringifyByChunk(e2, r2, t2);
            } catch (e3) {
              t2 = Math.floor(t2 / 2);
            }
            return i.stringifyByChar(e2);
          }
          function f(e2, t2) {
            for (var r2 = 0; r2 < e2.length; r2++) t2[r2] = e2[r2];
            return t2;
          }
          a.applyFromCharCode = s;
          var c = {};
          c.string = { string: n, array: function(e2) {
            return l(e2, new Array(e2.length));
          }, arraybuffer: function(e2) {
            return c.string.uint8array(e2).buffer;
          }, uint8array: function(e2) {
            return l(e2, new Uint8Array(e2.length));
          }, nodebuffer: function(e2) {
            return l(e2, r.allocBuffer(e2.length));
          } }, c.array = { string: s, array: n, arraybuffer: function(e2) {
            return new Uint8Array(e2).buffer;
          }, uint8array: function(e2) {
            return new Uint8Array(e2);
          }, nodebuffer: function(e2) {
            return r.newBufferFrom(e2);
          } }, c.arraybuffer = { string: function(e2) {
            return s(new Uint8Array(e2));
          }, array: function(e2) {
            return f(new Uint8Array(e2), new Array(e2.byteLength));
          }, arraybuffer: n, uint8array: function(e2) {
            return new Uint8Array(e2);
          }, nodebuffer: function(e2) {
            return r.newBufferFrom(new Uint8Array(e2));
          } }, c.uint8array = { string: s, array: function(e2) {
            return f(e2, new Array(e2.length));
          }, arraybuffer: function(e2) {
            return e2.buffer;
          }, uint8array: n, nodebuffer: function(e2) {
            return r.newBufferFrom(e2);
          } }, c.nodebuffer = { string: s, array: function(e2) {
            return f(e2, new Array(e2.length));
          }, arraybuffer: function(e2) {
            return c.nodebuffer.uint8array(e2).buffer;
          }, uint8array: function(e2) {
            return f(e2, new Uint8Array(e2.length));
          }, nodebuffer: n }, a.transformTo = function(e2, t2) {
            if (t2 = t2 || "", !e2) return t2;
            a.checkSupport(e2);
            var r2 = a.getTypeOf(t2);
            return c[r2][e2](t2);
          }, a.resolve = function(e2) {
            for (var t2 = e2.split("/"), r2 = [], n2 = 0; n2 < t2.length; n2++) {
              var i2 = t2[n2];
              "." === i2 || "" === i2 && 0 !== n2 && n2 !== t2.length - 1 || (".." === i2 ? r2.pop() : r2.push(i2));
            }
            return r2.join("/");
          }, a.getTypeOf = function(e2) {
            if ("string" == typeof e2) return "string";
            var t2 = Object.prototype.toString.call(e2);
            return "[object Array]" === t2 ? "array" : o.nodebuffer && r.isBuffer(e2) ? "nodebuffer" : o.uint8array && "[object Uint8Array]" === t2 ? "uint8array" : o.arraybuffer && "[object ArrayBuffer]" === t2 ? "arraybuffer" : void 0;
          }, a.checkSupport = function(e2) {
            if (!o[e2.toLowerCase()]) throw new Error(e2 + " is not supported by this platform");
          }, a.MAX_VALUE_16BITS = 65535, a.MAX_VALUE_32BITS = -1, a.pretty = function(e2) {
            var t2, r2, n2 = "";
            for (r2 = 0; r2 < (e2 || "").length; r2++) n2 += "\\x" + ((t2 = e2.charCodeAt(r2)) < 16 ? "0" : "") + t2.toString(16).toUpperCase();
            return n2;
          }, a.delay = function(e2, t2, r2) {
            setImmediate(function() {
              e2.apply(r2 || null, t2 || []);
            });
          }, a.inherits = function(e2, t2) {
            function r2() {
            }
            r2.prototype = t2.prototype, e2.prototype = new r2();
          }, a.extend = function() {
            var e2, t2, r2 = {};
            for (e2 = 0; e2 < arguments.length; e2++) for (t2 in arguments[e2]) Object.prototype.hasOwnProperty.call(arguments[e2], t2) && void 0 === r2[t2] && (r2[t2] = arguments[e2][t2]);
            return r2;
          }, a.prepareContent = function(r2, e2, n2, i2, s2) {
            return u.Promise.resolve(e2).then(function(n3) {
              return o.blob && (n3 instanceof Blob || -1 !== ["[object File]", "[object Blob]"].indexOf(Object.prototype.toString.call(n3))) ? void 0 !== Blob.prototype.arrayBuffer ? n3.arrayBuffer() : "undefined" != typeof FileReader ? new u.Promise(function(t2, r3) {
                var e3 = new FileReader();
                e3.onload = function(e4) {
                  t2(e4.target.result);
                }, e3.onerror = function(e4) {
                  r3(e4.target.error);
                }, e3.readAsArrayBuffer(n3);
              }) : u.Promise.reject(new Error(r2 + " is a Blob, but we have no way of reading it.")) : n3;
            }).then(function(e3) {
              var t2 = a.getTypeOf(e3);
              return t2 ? ("arraybuffer" === t2 ? e3 = a.transformTo("uint8array", e3) : "string" === t2 && (s2 ? e3 = h.decode(e3) : n2 && true !== i2 && (e3 = (function(e4) {
                return l(e4, o.uint8array ? new Uint8Array(e4.length) : new Array(e4.length));
              })(e3))), e3) : u.Promise.reject(new Error("Can't read the data of '" + r2 + "'. Is it in a supported JavaScript type (String, Blob, ArrayBuffer, etc) ?"));
            });
          };
        }, { "./base64": 1, "./external": 6, "./nodejsUtils": 14, "./support": 30, setimmediate: 54 }], 33: [function(e, t, r) {
          "use strict";
          var n = e("./reader/readerFor"), i = e("./utils"), s = e("./signature"), a = e("./zipEntry"), o = e("./support");
          function h(e2) {
            this.files = [], this.loadOptions = e2;
          }
          h.prototype = { checkSignature: function(e2) {
            if (!this.reader.readAndCheckSignature(e2)) {
              this.reader.index -= 4;
              var t2 = this.reader.readString(4);
              throw new Error("Corrupted zip or bug: unexpected signature (" + i.pretty(t2) + ", expected " + i.pretty(e2) + ")");
            }
          }, isSignature: function(e2, t2) {
            var r2 = this.reader.index;
            this.reader.setIndex(e2);
            var n2 = this.reader.readString(4) === t2;
            return this.reader.setIndex(r2), n2;
          }, readBlockEndOfCentral: function() {
            this.diskNumber = this.reader.readInt(2), this.diskWithCentralDirStart = this.reader.readInt(2), this.centralDirRecordsOnThisDisk = this.reader.readInt(2), this.centralDirRecords = this.reader.readInt(2), this.centralDirSize = this.reader.readInt(4), this.centralDirOffset = this.reader.readInt(4), this.zipCommentLength = this.reader.readInt(2);
            var e2 = this.reader.readData(this.zipCommentLength), t2 = o.uint8array ? "uint8array" : "array", r2 = i.transformTo(t2, e2);
            this.zipComment = this.loadOptions.decodeFileName(r2);
          }, readBlockZip64EndOfCentral: function() {
            this.zip64EndOfCentralSize = this.reader.readInt(8), this.reader.skip(4), this.diskNumber = this.reader.readInt(4), this.diskWithCentralDirStart = this.reader.readInt(4), this.centralDirRecordsOnThisDisk = this.reader.readInt(8), this.centralDirRecords = this.reader.readInt(8), this.centralDirSize = this.reader.readInt(8), this.centralDirOffset = this.reader.readInt(8), this.zip64ExtensibleData = {};
            for (var e2, t2, r2, n2 = this.zip64EndOfCentralSize - 44; 0 < n2; ) e2 = this.reader.readInt(2), t2 = this.reader.readInt(4), r2 = this.reader.readData(t2), this.zip64ExtensibleData[e2] = { id: e2, length: t2, value: r2 };
          }, readBlockZip64EndOfCentralLocator: function() {
            if (this.diskWithZip64CentralDirStart = this.reader.readInt(4), this.relativeOffsetEndOfZip64CentralDir = this.reader.readInt(8), this.disksCount = this.reader.readInt(4), 1 < this.disksCount) throw new Error("Multi-volumes zip are not supported");
          }, readLocalFiles: function() {
            var e2, t2;
            for (e2 = 0; e2 < this.files.length; e2++) t2 = this.files[e2], this.reader.setIndex(t2.localHeaderOffset), this.checkSignature(s.LOCAL_FILE_HEADER), t2.readLocalPart(this.reader), t2.handleUTF8(), t2.processAttributes();
          }, readCentralDir: function() {
            var e2;
            for (this.reader.setIndex(this.centralDirOffset); this.reader.readAndCheckSignature(s.CENTRAL_FILE_HEADER); ) (e2 = new a({ zip64: this.zip64 }, this.loadOptions)).readCentralPart(this.reader), this.files.push(e2);
            if (this.centralDirRecords !== this.files.length && 0 !== this.centralDirRecords && 0 === this.files.length) throw new Error("Corrupted zip or bug: expected " + this.centralDirRecords + " records in central dir, got " + this.files.length);
          }, readEndOfCentral: function() {
            var e2 = this.reader.lastIndexOfSignature(s.CENTRAL_DIRECTORY_END);
            if (e2 < 0) throw !this.isSignature(0, s.LOCAL_FILE_HEADER) ? new Error("Can't find end of central directory : is this a zip file ? If it is, see https://stuk.github.io/jszip/documentation/howto/read_zip.html") : new Error("Corrupted zip: can't find end of central directory");
            this.reader.setIndex(e2);
            var t2 = e2;
            if (this.checkSignature(s.CENTRAL_DIRECTORY_END), this.readBlockEndOfCentral(), this.diskNumber === i.MAX_VALUE_16BITS || this.diskWithCentralDirStart === i.MAX_VALUE_16BITS || this.centralDirRecordsOnThisDisk === i.MAX_VALUE_16BITS || this.centralDirRecords === i.MAX_VALUE_16BITS || this.centralDirSize === i.MAX_VALUE_32BITS || this.centralDirOffset === i.MAX_VALUE_32BITS) {
              if (this.zip64 = true, (e2 = this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR)) < 0) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory locator");
              if (this.reader.setIndex(e2), this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_LOCATOR), this.readBlockZip64EndOfCentralLocator(), !this.isSignature(this.relativeOffsetEndOfZip64CentralDir, s.ZIP64_CENTRAL_DIRECTORY_END) && (this.relativeOffsetEndOfZip64CentralDir = this.reader.lastIndexOfSignature(s.ZIP64_CENTRAL_DIRECTORY_END), this.relativeOffsetEndOfZip64CentralDir < 0)) throw new Error("Corrupted zip: can't find the ZIP64 end of central directory");
              this.reader.setIndex(this.relativeOffsetEndOfZip64CentralDir), this.checkSignature(s.ZIP64_CENTRAL_DIRECTORY_END), this.readBlockZip64EndOfCentral();
            }
            var r2 = this.centralDirOffset + this.centralDirSize;
            this.zip64 && (r2 += 20, r2 += 12 + this.zip64EndOfCentralSize);
            var n2 = t2 - r2;
            if (0 < n2) this.isSignature(t2, s.CENTRAL_FILE_HEADER) || (this.reader.zero = n2);
            else if (n2 < 0) throw new Error("Corrupted zip: missing " + Math.abs(n2) + " bytes.");
          }, prepareReader: function(e2) {
            this.reader = n(e2);
          }, load: function(e2) {
            this.prepareReader(e2), this.readEndOfCentral(), this.readCentralDir(), this.readLocalFiles();
          } }, t.exports = h;
        }, { "./reader/readerFor": 22, "./signature": 23, "./support": 30, "./utils": 32, "./zipEntry": 34 }], 34: [function(e, t, r) {
          "use strict";
          var n = e("./reader/readerFor"), s = e("./utils"), i = e("./compressedObject"), a = e("./crc32"), o = e("./utf8"), h = e("./compressions"), u = e("./support");
          function l(e2, t2) {
            this.options = e2, this.loadOptions = t2;
          }
          l.prototype = { isEncrypted: function() {
            return 1 == (1 & this.bitFlag);
          }, useUTF8: function() {
            return 2048 == (2048 & this.bitFlag);
          }, readLocalPart: function(e2) {
            var t2, r2;
            if (e2.skip(22), this.fileNameLength = e2.readInt(2), r2 = e2.readInt(2), this.fileName = e2.readData(this.fileNameLength), e2.skip(r2), -1 === this.compressedSize || -1 === this.uncompressedSize) throw new Error("Bug or corrupted zip : didn't get enough information from the central directory (compressedSize === -1 || uncompressedSize === -1)");
            if (null === (t2 = (function(e3) {
              for (var t3 in h) if (Object.prototype.hasOwnProperty.call(h, t3) && h[t3].magic === e3) return h[t3];
              return null;
            })(this.compressionMethod))) throw new Error("Corrupted zip : compression " + s.pretty(this.compressionMethod) + " unknown (inner file : " + s.transformTo("string", this.fileName) + ")");
            this.decompressed = new i(this.compressedSize, this.uncompressedSize, this.crc32, t2, e2.readData(this.compressedSize));
          }, readCentralPart: function(e2) {
            this.versionMadeBy = e2.readInt(2), e2.skip(2), this.bitFlag = e2.readInt(2), this.compressionMethod = e2.readString(2), this.date = e2.readDate(), this.crc32 = e2.readInt(4), this.compressedSize = e2.readInt(4), this.uncompressedSize = e2.readInt(4);
            var t2 = e2.readInt(2);
            if (this.extraFieldsLength = e2.readInt(2), this.fileCommentLength = e2.readInt(2), this.diskNumberStart = e2.readInt(2), this.internalFileAttributes = e2.readInt(2), this.externalFileAttributes = e2.readInt(4), this.localHeaderOffset = e2.readInt(4), this.isEncrypted()) throw new Error("Encrypted zip are not supported");
            e2.skip(t2), this.readExtraFields(e2), this.parseZIP64ExtraField(e2), this.fileComment = e2.readData(this.fileCommentLength);
          }, processAttributes: function() {
            this.unixPermissions = null, this.dosPermissions = null;
            var e2 = this.versionMadeBy >> 8;
            this.dir = !!(16 & this.externalFileAttributes), 0 == e2 && (this.dosPermissions = 63 & this.externalFileAttributes), 3 == e2 && (this.unixPermissions = this.externalFileAttributes >> 16 & 65535), this.dir || "/" !== this.fileNameStr.slice(-1) || (this.dir = true);
          }, parseZIP64ExtraField: function() {
            if (this.extraFields[1]) {
              var e2 = n(this.extraFields[1].value);
              this.uncompressedSize === s.MAX_VALUE_32BITS && (this.uncompressedSize = e2.readInt(8)), this.compressedSize === s.MAX_VALUE_32BITS && (this.compressedSize = e2.readInt(8)), this.localHeaderOffset === s.MAX_VALUE_32BITS && (this.localHeaderOffset = e2.readInt(8)), this.diskNumberStart === s.MAX_VALUE_32BITS && (this.diskNumberStart = e2.readInt(4));
            }
          }, readExtraFields: function(e2) {
            var t2, r2, n2, i2 = e2.index + this.extraFieldsLength;
            for (this.extraFields || (this.extraFields = {}); e2.index + 4 < i2; ) t2 = e2.readInt(2), r2 = e2.readInt(2), n2 = e2.readData(r2), this.extraFields[t2] = { id: t2, length: r2, value: n2 };
            e2.setIndex(i2);
          }, handleUTF8: function() {
            var e2 = u.uint8array ? "uint8array" : "array";
            if (this.useUTF8()) this.fileNameStr = o.utf8decode(this.fileName), this.fileCommentStr = o.utf8decode(this.fileComment);
            else {
              var t2 = this.findExtraFieldUnicodePath();
              if (null !== t2) this.fileNameStr = t2;
              else {
                var r2 = s.transformTo(e2, this.fileName);
                this.fileNameStr = this.loadOptions.decodeFileName(r2);
              }
              var n2 = this.findExtraFieldUnicodeComment();
              if (null !== n2) this.fileCommentStr = n2;
              else {
                var i2 = s.transformTo(e2, this.fileComment);
                this.fileCommentStr = this.loadOptions.decodeFileName(i2);
              }
            }
          }, findExtraFieldUnicodePath: function() {
            var e2 = this.extraFields[28789];
            if (e2) {
              var t2 = n(e2.value);
              return 1 !== t2.readInt(1) ? null : a(this.fileName) !== t2.readInt(4) ? null : o.utf8decode(t2.readData(e2.length - 5));
            }
            return null;
          }, findExtraFieldUnicodeComment: function() {
            var e2 = this.extraFields[25461];
            if (e2) {
              var t2 = n(e2.value);
              return 1 !== t2.readInt(1) ? null : a(this.fileComment) !== t2.readInt(4) ? null : o.utf8decode(t2.readData(e2.length - 5));
            }
            return null;
          } }, t.exports = l;
        }, { "./compressedObject": 2, "./compressions": 3, "./crc32": 4, "./reader/readerFor": 22, "./support": 30, "./utf8": 31, "./utils": 32 }], 35: [function(e, t, r) {
          "use strict";
          function n(e2, t2, r2) {
            this.name = e2, this.dir = r2.dir, this.date = r2.date, this.comment = r2.comment, this.unixPermissions = r2.unixPermissions, this.dosPermissions = r2.dosPermissions, this._data = t2, this._dataBinary = r2.binary, this.options = { compression: r2.compression, compressionOptions: r2.compressionOptions };
          }
          var s = e("./stream/StreamHelper"), i = e("./stream/DataWorker"), a = e("./utf8"), o = e("./compressedObject"), h = e("./stream/GenericWorker");
          n.prototype = { internalStream: function(e2) {
            var t2 = null, r2 = "string";
            try {
              if (!e2) throw new Error("No output type specified.");
              var n2 = "string" === (r2 = e2.toLowerCase()) || "text" === r2;
              "binarystring" !== r2 && "text" !== r2 || (r2 = "string"), t2 = this._decompressWorker();
              var i2 = !this._dataBinary;
              i2 && !n2 && (t2 = t2.pipe(new a.Utf8EncodeWorker())), !i2 && n2 && (t2 = t2.pipe(new a.Utf8DecodeWorker()));
            } catch (e3) {
              (t2 = new h("error")).error(e3);
            }
            return new s(t2, r2, "");
          }, async: function(e2, t2) {
            return this.internalStream(e2).accumulate(t2);
          }, nodeStream: function(e2, t2) {
            return this.internalStream(e2 || "nodebuffer").toNodejsStream(t2);
          }, _compressWorker: function(e2, t2) {
            if (this._data instanceof o && this._data.compression.magic === e2.magic) return this._data.getCompressedWorker();
            var r2 = this._decompressWorker();
            return this._dataBinary || (r2 = r2.pipe(new a.Utf8EncodeWorker())), o.createWorkerFrom(r2, e2, t2);
          }, _decompressWorker: function() {
            return this._data instanceof o ? this._data.getContentWorker() : this._data instanceof h ? this._data : new i(this._data);
          } };
          for (var u = ["asText", "asBinary", "asNodeBuffer", "asUint8Array", "asArrayBuffer"], l = function() {
            throw new Error("This method has been removed in JSZip 3.0, please check the upgrade guide.");
          }, f = 0; f < u.length; f++) n.prototype[u[f]] = l;
          t.exports = n;
        }, { "./compressedObject": 2, "./stream/DataWorker": 27, "./stream/GenericWorker": 28, "./stream/StreamHelper": 29, "./utf8": 31 }], 36: [function(e, l, t) {
          (function(t2) {
            "use strict";
            var r, n, e2 = t2.MutationObserver || t2.WebKitMutationObserver;
            if (e2) {
              var i = 0, s = new e2(u), a = t2.document.createTextNode("");
              s.observe(a, { characterData: true }), r = function() {
                a.data = i = ++i % 2;
              };
            } else if (t2.setImmediate || void 0 === t2.MessageChannel) r = "document" in t2 && "onreadystatechange" in t2.document.createElement("script") ? function() {
              var e3 = t2.document.createElement("script");
              e3.onreadystatechange = function() {
                u(), e3.onreadystatechange = null, e3.parentNode.removeChild(e3), e3 = null;
              }, t2.document.documentElement.appendChild(e3);
            } : function() {
              setTimeout(u, 0);
            };
            else {
              var o = new t2.MessageChannel();
              o.port1.onmessage = u, r = function() {
                o.port2.postMessage(0);
              };
            }
            var h = [];
            function u() {
              var e3, t3;
              n = true;
              for (var r2 = h.length; r2; ) {
                for (t3 = h, h = [], e3 = -1; ++e3 < r2; ) t3[e3]();
                r2 = h.length;
              }
              n = false;
            }
            l.exports = function(e3) {
              1 !== h.push(e3) || n || r();
            };
          }).call(this, "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
        }, {}], 37: [function(e, t, r) {
          "use strict";
          var i = e("immediate");
          function u() {
          }
          var l = {}, s = ["REJECTED"], a = ["FULFILLED"], n = ["PENDING"];
          function o(e2) {
            if ("function" != typeof e2) throw new TypeError("resolver must be a function");
            this.state = n, this.queue = [], this.outcome = void 0, e2 !== u && d(this, e2);
          }
          function h(e2, t2, r2) {
            this.promise = e2, "function" == typeof t2 && (this.onFulfilled = t2, this.callFulfilled = this.otherCallFulfilled), "function" == typeof r2 && (this.onRejected = r2, this.callRejected = this.otherCallRejected);
          }
          function f(t2, r2, n2) {
            i(function() {
              var e2;
              try {
                e2 = r2(n2);
              } catch (e3) {
                return l.reject(t2, e3);
              }
              e2 === t2 ? l.reject(t2, new TypeError("Cannot resolve promise with itself")) : l.resolve(t2, e2);
            });
          }
          function c(e2) {
            var t2 = e2 && e2.then;
            if (e2 && ("object" == typeof e2 || "function" == typeof e2) && "function" == typeof t2) return function() {
              t2.apply(e2, arguments);
            };
          }
          function d(t2, e2) {
            var r2 = false;
            function n2(e3) {
              r2 || (r2 = true, l.reject(t2, e3));
            }
            function i2(e3) {
              r2 || (r2 = true, l.resolve(t2, e3));
            }
            var s2 = p(function() {
              e2(i2, n2);
            });
            "error" === s2.status && n2(s2.value);
          }
          function p(e2, t2) {
            var r2 = {};
            try {
              r2.value = e2(t2), r2.status = "success";
            } catch (e3) {
              r2.status = "error", r2.value = e3;
            }
            return r2;
          }
          (t.exports = o).prototype.finally = function(t2) {
            if ("function" != typeof t2) return this;
            var r2 = this.constructor;
            return this.then(function(e2) {
              return r2.resolve(t2()).then(function() {
                return e2;
              });
            }, function(e2) {
              return r2.resolve(t2()).then(function() {
                throw e2;
              });
            });
          }, o.prototype.catch = function(e2) {
            return this.then(null, e2);
          }, o.prototype.then = function(e2, t2) {
            if ("function" != typeof e2 && this.state === a || "function" != typeof t2 && this.state === s) return this;
            var r2 = new this.constructor(u);
            this.state !== n ? f(r2, this.state === a ? e2 : t2, this.outcome) : this.queue.push(new h(r2, e2, t2));
            return r2;
          }, h.prototype.callFulfilled = function(e2) {
            l.resolve(this.promise, e2);
          }, h.prototype.otherCallFulfilled = function(e2) {
            f(this.promise, this.onFulfilled, e2);
          }, h.prototype.callRejected = function(e2) {
            l.reject(this.promise, e2);
          }, h.prototype.otherCallRejected = function(e2) {
            f(this.promise, this.onRejected, e2);
          }, l.resolve = function(e2, t2) {
            var r2 = p(c, t2);
            if ("error" === r2.status) return l.reject(e2, r2.value);
            var n2 = r2.value;
            if (n2) d(e2, n2);
            else {
              e2.state = a, e2.outcome = t2;
              for (var i2 = -1, s2 = e2.queue.length; ++i2 < s2; ) e2.queue[i2].callFulfilled(t2);
            }
            return e2;
          }, l.reject = function(e2, t2) {
            e2.state = s, e2.outcome = t2;
            for (var r2 = -1, n2 = e2.queue.length; ++r2 < n2; ) e2.queue[r2].callRejected(t2);
            return e2;
          }, o.resolve = function(e2) {
            if (e2 instanceof this) return e2;
            return l.resolve(new this(u), e2);
          }, o.reject = function(e2) {
            var t2 = new this(u);
            return l.reject(t2, e2);
          }, o.all = function(e2) {
            var r2 = this;
            if ("[object Array]" !== Object.prototype.toString.call(e2)) return this.reject(new TypeError("must be an array"));
            var n2 = e2.length, i2 = false;
            if (!n2) return this.resolve([]);
            var s2 = new Array(n2), a2 = 0, t2 = -1, o2 = new this(u);
            for (; ++t2 < n2; ) h2(e2[t2], t2);
            return o2;
            function h2(e3, t3) {
              r2.resolve(e3).then(function(e4) {
                s2[t3] = e4, ++a2 !== n2 || i2 || (i2 = true, l.resolve(o2, s2));
              }, function(e4) {
                i2 || (i2 = true, l.reject(o2, e4));
              });
            }
          }, o.race = function(e2) {
            var t2 = this;
            if ("[object Array]" !== Object.prototype.toString.call(e2)) return this.reject(new TypeError("must be an array"));
            var r2 = e2.length, n2 = false;
            if (!r2) return this.resolve([]);
            var i2 = -1, s2 = new this(u);
            for (; ++i2 < r2; ) a2 = e2[i2], t2.resolve(a2).then(function(e3) {
              n2 || (n2 = true, l.resolve(s2, e3));
            }, function(e3) {
              n2 || (n2 = true, l.reject(s2, e3));
            });
            var a2;
            return s2;
          };
        }, { immediate: 36 }], 38: [function(e, t, r) {
          "use strict";
          var n = {};
          (0, e("./lib/utils/common").assign)(n, e("./lib/deflate"), e("./lib/inflate"), e("./lib/zlib/constants")), t.exports = n;
        }, { "./lib/deflate": 39, "./lib/inflate": 40, "./lib/utils/common": 41, "./lib/zlib/constants": 44 }], 39: [function(e, t, r) {
          "use strict";
          var a = e("./zlib/deflate"), o = e("./utils/common"), h = e("./utils/strings"), i = e("./zlib/messages"), s = e("./zlib/zstream"), u = Object.prototype.toString, l = 0, f = -1, c = 0, d = 8;
          function p(e2) {
            if (!(this instanceof p)) return new p(e2);
            this.options = o.assign({ level: f, method: d, chunkSize: 16384, windowBits: 15, memLevel: 8, strategy: c, to: "" }, e2 || {});
            var t2 = this.options;
            t2.raw && 0 < t2.windowBits ? t2.windowBits = -t2.windowBits : t2.gzip && 0 < t2.windowBits && t2.windowBits < 16 && (t2.windowBits += 16), this.err = 0, this.msg = "", this.ended = false, this.chunks = [], this.strm = new s(), this.strm.avail_out = 0;
            var r2 = a.deflateInit2(this.strm, t2.level, t2.method, t2.windowBits, t2.memLevel, t2.strategy);
            if (r2 !== l) throw new Error(i[r2]);
            if (t2.header && a.deflateSetHeader(this.strm, t2.header), t2.dictionary) {
              var n2;
              if (n2 = "string" == typeof t2.dictionary ? h.string2buf(t2.dictionary) : "[object ArrayBuffer]" === u.call(t2.dictionary) ? new Uint8Array(t2.dictionary) : t2.dictionary, (r2 = a.deflateSetDictionary(this.strm, n2)) !== l) throw new Error(i[r2]);
              this._dict_set = true;
            }
          }
          function n(e2, t2) {
            var r2 = new p(t2);
            if (r2.push(e2, true), r2.err) throw r2.msg || i[r2.err];
            return r2.result;
          }
          p.prototype.push = function(e2, t2) {
            var r2, n2, i2 = this.strm, s2 = this.options.chunkSize;
            if (this.ended) return false;
            n2 = t2 === ~~t2 ? t2 : true === t2 ? 4 : 0, "string" == typeof e2 ? i2.input = h.string2buf(e2) : "[object ArrayBuffer]" === u.call(e2) ? i2.input = new Uint8Array(e2) : i2.input = e2, i2.next_in = 0, i2.avail_in = i2.input.length;
            do {
              if (0 === i2.avail_out && (i2.output = new o.Buf8(s2), i2.next_out = 0, i2.avail_out = s2), 1 !== (r2 = a.deflate(i2, n2)) && r2 !== l) return this.onEnd(r2), !(this.ended = true);
              0 !== i2.avail_out && (0 !== i2.avail_in || 4 !== n2 && 2 !== n2) || ("string" === this.options.to ? this.onData(h.buf2binstring(o.shrinkBuf(i2.output, i2.next_out))) : this.onData(o.shrinkBuf(i2.output, i2.next_out)));
            } while ((0 < i2.avail_in || 0 === i2.avail_out) && 1 !== r2);
            return 4 === n2 ? (r2 = a.deflateEnd(this.strm), this.onEnd(r2), this.ended = true, r2 === l) : 2 !== n2 || (this.onEnd(l), !(i2.avail_out = 0));
          }, p.prototype.onData = function(e2) {
            this.chunks.push(e2);
          }, p.prototype.onEnd = function(e2) {
            e2 === l && ("string" === this.options.to ? this.result = this.chunks.join("") : this.result = o.flattenChunks(this.chunks)), this.chunks = [], this.err = e2, this.msg = this.strm.msg;
          }, r.Deflate = p, r.deflate = n, r.deflateRaw = function(e2, t2) {
            return (t2 = t2 || {}).raw = true, n(e2, t2);
          }, r.gzip = function(e2, t2) {
            return (t2 = t2 || {}).gzip = true, n(e2, t2);
          };
        }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/deflate": 46, "./zlib/messages": 51, "./zlib/zstream": 53 }], 40: [function(e, t, r) {
          "use strict";
          var c = e("./zlib/inflate"), d = e("./utils/common"), p = e("./utils/strings"), m = e("./zlib/constants"), n = e("./zlib/messages"), i = e("./zlib/zstream"), s = e("./zlib/gzheader"), _ = Object.prototype.toString;
          function a(e2) {
            if (!(this instanceof a)) return new a(e2);
            this.options = d.assign({ chunkSize: 16384, windowBits: 0, to: "" }, e2 || {});
            var t2 = this.options;
            t2.raw && 0 <= t2.windowBits && t2.windowBits < 16 && (t2.windowBits = -t2.windowBits, 0 === t2.windowBits && (t2.windowBits = -15)), !(0 <= t2.windowBits && t2.windowBits < 16) || e2 && e2.windowBits || (t2.windowBits += 32), 15 < t2.windowBits && t2.windowBits < 48 && 0 == (15 & t2.windowBits) && (t2.windowBits |= 15), this.err = 0, this.msg = "", this.ended = false, this.chunks = [], this.strm = new i(), this.strm.avail_out = 0;
            var r2 = c.inflateInit2(this.strm, t2.windowBits);
            if (r2 !== m.Z_OK) throw new Error(n[r2]);
            this.header = new s(), c.inflateGetHeader(this.strm, this.header);
          }
          function o(e2, t2) {
            var r2 = new a(t2);
            if (r2.push(e2, true), r2.err) throw r2.msg || n[r2.err];
            return r2.result;
          }
          a.prototype.push = function(e2, t2) {
            var r2, n2, i2, s2, a2, o2, h = this.strm, u = this.options.chunkSize, l = this.options.dictionary, f = false;
            if (this.ended) return false;
            n2 = t2 === ~~t2 ? t2 : true === t2 ? m.Z_FINISH : m.Z_NO_FLUSH, "string" == typeof e2 ? h.input = p.binstring2buf(e2) : "[object ArrayBuffer]" === _.call(e2) ? h.input = new Uint8Array(e2) : h.input = e2, h.next_in = 0, h.avail_in = h.input.length;
            do {
              if (0 === h.avail_out && (h.output = new d.Buf8(u), h.next_out = 0, h.avail_out = u), (r2 = c.inflate(h, m.Z_NO_FLUSH)) === m.Z_NEED_DICT && l && (o2 = "string" == typeof l ? p.string2buf(l) : "[object ArrayBuffer]" === _.call(l) ? new Uint8Array(l) : l, r2 = c.inflateSetDictionary(this.strm, o2)), r2 === m.Z_BUF_ERROR && true === f && (r2 = m.Z_OK, f = false), r2 !== m.Z_STREAM_END && r2 !== m.Z_OK) return this.onEnd(r2), !(this.ended = true);
              h.next_out && (0 !== h.avail_out && r2 !== m.Z_STREAM_END && (0 !== h.avail_in || n2 !== m.Z_FINISH && n2 !== m.Z_SYNC_FLUSH) || ("string" === this.options.to ? (i2 = p.utf8border(h.output, h.next_out), s2 = h.next_out - i2, a2 = p.buf2string(h.output, i2), h.next_out = s2, h.avail_out = u - s2, s2 && d.arraySet(h.output, h.output, i2, s2, 0), this.onData(a2)) : this.onData(d.shrinkBuf(h.output, h.next_out)))), 0 === h.avail_in && 0 === h.avail_out && (f = true);
            } while ((0 < h.avail_in || 0 === h.avail_out) && r2 !== m.Z_STREAM_END);
            return r2 === m.Z_STREAM_END && (n2 = m.Z_FINISH), n2 === m.Z_FINISH ? (r2 = c.inflateEnd(this.strm), this.onEnd(r2), this.ended = true, r2 === m.Z_OK) : n2 !== m.Z_SYNC_FLUSH || (this.onEnd(m.Z_OK), !(h.avail_out = 0));
          }, a.prototype.onData = function(e2) {
            this.chunks.push(e2);
          }, a.prototype.onEnd = function(e2) {
            e2 === m.Z_OK && ("string" === this.options.to ? this.result = this.chunks.join("") : this.result = d.flattenChunks(this.chunks)), this.chunks = [], this.err = e2, this.msg = this.strm.msg;
          }, r.Inflate = a, r.inflate = o, r.inflateRaw = function(e2, t2) {
            return (t2 = t2 || {}).raw = true, o(e2, t2);
          }, r.ungzip = o;
        }, { "./utils/common": 41, "./utils/strings": 42, "./zlib/constants": 44, "./zlib/gzheader": 47, "./zlib/inflate": 49, "./zlib/messages": 51, "./zlib/zstream": 53 }], 41: [function(e, t, r) {
          "use strict";
          var n = "undefined" != typeof Uint8Array && "undefined" != typeof Uint16Array && "undefined" != typeof Int32Array;
          r.assign = function(e2) {
            for (var t2 = Array.prototype.slice.call(arguments, 1); t2.length; ) {
              var r2 = t2.shift();
              if (r2) {
                if ("object" != typeof r2) throw new TypeError(r2 + "must be non-object");
                for (var n2 in r2) r2.hasOwnProperty(n2) && (e2[n2] = r2[n2]);
              }
            }
            return e2;
          }, r.shrinkBuf = function(e2, t2) {
            return e2.length === t2 ? e2 : e2.subarray ? e2.subarray(0, t2) : (e2.length = t2, e2);
          };
          var i = { arraySet: function(e2, t2, r2, n2, i2) {
            if (t2.subarray && e2.subarray) e2.set(t2.subarray(r2, r2 + n2), i2);
            else for (var s2 = 0; s2 < n2; s2++) e2[i2 + s2] = t2[r2 + s2];
          }, flattenChunks: function(e2) {
            var t2, r2, n2, i2, s2, a;
            for (t2 = n2 = 0, r2 = e2.length; t2 < r2; t2++) n2 += e2[t2].length;
            for (a = new Uint8Array(n2), t2 = i2 = 0, r2 = e2.length; t2 < r2; t2++) s2 = e2[t2], a.set(s2, i2), i2 += s2.length;
            return a;
          } }, s = { arraySet: function(e2, t2, r2, n2, i2) {
            for (var s2 = 0; s2 < n2; s2++) e2[i2 + s2] = t2[r2 + s2];
          }, flattenChunks: function(e2) {
            return [].concat.apply([], e2);
          } };
          r.setTyped = function(e2) {
            e2 ? (r.Buf8 = Uint8Array, r.Buf16 = Uint16Array, r.Buf32 = Int32Array, r.assign(r, i)) : (r.Buf8 = Array, r.Buf16 = Array, r.Buf32 = Array, r.assign(r, s));
          }, r.setTyped(n);
        }, {}], 42: [function(e, t, r) {
          "use strict";
          var h = e("./common"), i = true, s = true;
          try {
            String.fromCharCode.apply(null, [0]);
          } catch (e2) {
            i = false;
          }
          try {
            String.fromCharCode.apply(null, new Uint8Array(1));
          } catch (e2) {
            s = false;
          }
          for (var u = new h.Buf8(256), n = 0; n < 256; n++) u[n] = 252 <= n ? 6 : 248 <= n ? 5 : 240 <= n ? 4 : 224 <= n ? 3 : 192 <= n ? 2 : 1;
          function l(e2, t2) {
            if (t2 < 65537 && (e2.subarray && s || !e2.subarray && i)) return String.fromCharCode.apply(null, h.shrinkBuf(e2, t2));
            for (var r2 = "", n2 = 0; n2 < t2; n2++) r2 += String.fromCharCode(e2[n2]);
            return r2;
          }
          u[254] = u[254] = 1, r.string2buf = function(e2) {
            var t2, r2, n2, i2, s2, a = e2.length, o = 0;
            for (i2 = 0; i2 < a; i2++) 55296 == (64512 & (r2 = e2.charCodeAt(i2))) && i2 + 1 < a && 56320 == (64512 & (n2 = e2.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), o += r2 < 128 ? 1 : r2 < 2048 ? 2 : r2 < 65536 ? 3 : 4;
            for (t2 = new h.Buf8(o), i2 = s2 = 0; s2 < o; i2++) 55296 == (64512 & (r2 = e2.charCodeAt(i2))) && i2 + 1 < a && 56320 == (64512 & (n2 = e2.charCodeAt(i2 + 1))) && (r2 = 65536 + (r2 - 55296 << 10) + (n2 - 56320), i2++), r2 < 128 ? t2[s2++] = r2 : (r2 < 2048 ? t2[s2++] = 192 | r2 >>> 6 : (r2 < 65536 ? t2[s2++] = 224 | r2 >>> 12 : (t2[s2++] = 240 | r2 >>> 18, t2[s2++] = 128 | r2 >>> 12 & 63), t2[s2++] = 128 | r2 >>> 6 & 63), t2[s2++] = 128 | 63 & r2);
            return t2;
          }, r.buf2binstring = function(e2) {
            return l(e2, e2.length);
          }, r.binstring2buf = function(e2) {
            for (var t2 = new h.Buf8(e2.length), r2 = 0, n2 = t2.length; r2 < n2; r2++) t2[r2] = e2.charCodeAt(r2);
            return t2;
          }, r.buf2string = function(e2, t2) {
            var r2, n2, i2, s2, a = t2 || e2.length, o = new Array(2 * a);
            for (r2 = n2 = 0; r2 < a; ) if ((i2 = e2[r2++]) < 128) o[n2++] = i2;
            else if (4 < (s2 = u[i2])) o[n2++] = 65533, r2 += s2 - 1;
            else {
              for (i2 &= 2 === s2 ? 31 : 3 === s2 ? 15 : 7; 1 < s2 && r2 < a; ) i2 = i2 << 6 | 63 & e2[r2++], s2--;
              1 < s2 ? o[n2++] = 65533 : i2 < 65536 ? o[n2++] = i2 : (i2 -= 65536, o[n2++] = 55296 | i2 >> 10 & 1023, o[n2++] = 56320 | 1023 & i2);
            }
            return l(o, n2);
          }, r.utf8border = function(e2, t2) {
            var r2;
            for ((t2 = t2 || e2.length) > e2.length && (t2 = e2.length), r2 = t2 - 1; 0 <= r2 && 128 == (192 & e2[r2]); ) r2--;
            return r2 < 0 ? t2 : 0 === r2 ? t2 : r2 + u[e2[r2]] > t2 ? r2 : t2;
          };
        }, { "./common": 41 }], 43: [function(e, t, r) {
          "use strict";
          t.exports = function(e2, t2, r2, n) {
            for (var i = 65535 & e2 | 0, s = e2 >>> 16 & 65535 | 0, a = 0; 0 !== r2; ) {
              for (r2 -= a = 2e3 < r2 ? 2e3 : r2; s = s + (i = i + t2[n++] | 0) | 0, --a; ) ;
              i %= 65521, s %= 65521;
            }
            return i | s << 16 | 0;
          };
        }, {}], 44: [function(e, t, r) {
          "use strict";
          t.exports = { Z_NO_FLUSH: 0, Z_PARTIAL_FLUSH: 1, Z_SYNC_FLUSH: 2, Z_FULL_FLUSH: 3, Z_FINISH: 4, Z_BLOCK: 5, Z_TREES: 6, Z_OK: 0, Z_STREAM_END: 1, Z_NEED_DICT: 2, Z_ERRNO: -1, Z_STREAM_ERROR: -2, Z_DATA_ERROR: -3, Z_BUF_ERROR: -5, Z_NO_COMPRESSION: 0, Z_BEST_SPEED: 1, Z_BEST_COMPRESSION: 9, Z_DEFAULT_COMPRESSION: -1, Z_FILTERED: 1, Z_HUFFMAN_ONLY: 2, Z_RLE: 3, Z_FIXED: 4, Z_DEFAULT_STRATEGY: 0, Z_BINARY: 0, Z_TEXT: 1, Z_UNKNOWN: 2, Z_DEFLATED: 8 };
        }, {}], 45: [function(e, t, r) {
          "use strict";
          var o = (function() {
            for (var e2, t2 = [], r2 = 0; r2 < 256; r2++) {
              e2 = r2;
              for (var n = 0; n < 8; n++) e2 = 1 & e2 ? 3988292384 ^ e2 >>> 1 : e2 >>> 1;
              t2[r2] = e2;
            }
            return t2;
          })();
          t.exports = function(e2, t2, r2, n) {
            var i = o, s = n + r2;
            e2 ^= -1;
            for (var a = n; a < s; a++) e2 = e2 >>> 8 ^ i[255 & (e2 ^ t2[a])];
            return -1 ^ e2;
          };
        }, {}], 46: [function(e, t, r) {
          "use strict";
          var h, c = e("../utils/common"), u = e("./trees"), d = e("./adler32"), p = e("./crc32"), n = e("./messages"), l = 0, f = 4, m = 0, _ = -2, g = -1, b = 4, i = 2, v = 8, y = 9, s = 286, a = 30, o = 19, w = 2 * s + 1, k = 15, x = 3, S = 258, z = S + x + 1, C = 42, E = 113, A = 1, I = 2, O = 3, B = 4;
          function R(e2, t2) {
            return e2.msg = n[t2], t2;
          }
          function T(e2) {
            return (e2 << 1) - (4 < e2 ? 9 : 0);
          }
          function D(e2) {
            for (var t2 = e2.length; 0 <= --t2; ) e2[t2] = 0;
          }
          function F(e2) {
            var t2 = e2.state, r2 = t2.pending;
            r2 > e2.avail_out && (r2 = e2.avail_out), 0 !== r2 && (c.arraySet(e2.output, t2.pending_buf, t2.pending_out, r2, e2.next_out), e2.next_out += r2, t2.pending_out += r2, e2.total_out += r2, e2.avail_out -= r2, t2.pending -= r2, 0 === t2.pending && (t2.pending_out = 0));
          }
          function N(e2, t2) {
            u._tr_flush_block(e2, 0 <= e2.block_start ? e2.block_start : -1, e2.strstart - e2.block_start, t2), e2.block_start = e2.strstart, F(e2.strm);
          }
          function U(e2, t2) {
            e2.pending_buf[e2.pending++] = t2;
          }
          function P(e2, t2) {
            e2.pending_buf[e2.pending++] = t2 >>> 8 & 255, e2.pending_buf[e2.pending++] = 255 & t2;
          }
          function L(e2, t2) {
            var r2, n2, i2 = e2.max_chain_length, s2 = e2.strstart, a2 = e2.prev_length, o2 = e2.nice_match, h2 = e2.strstart > e2.w_size - z ? e2.strstart - (e2.w_size - z) : 0, u2 = e2.window, l2 = e2.w_mask, f2 = e2.prev, c2 = e2.strstart + S, d2 = u2[s2 + a2 - 1], p2 = u2[s2 + a2];
            e2.prev_length >= e2.good_match && (i2 >>= 2), o2 > e2.lookahead && (o2 = e2.lookahead);
            do {
              if (u2[(r2 = t2) + a2] === p2 && u2[r2 + a2 - 1] === d2 && u2[r2] === u2[s2] && u2[++r2] === u2[s2 + 1]) {
                s2 += 2, r2++;
                do {
                } while (u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && u2[++s2] === u2[++r2] && s2 < c2);
                if (n2 = S - (c2 - s2), s2 = c2 - S, a2 < n2) {
                  if (e2.match_start = t2, o2 <= (a2 = n2)) break;
                  d2 = u2[s2 + a2 - 1], p2 = u2[s2 + a2];
                }
              }
            } while ((t2 = f2[t2 & l2]) > h2 && 0 != --i2);
            return a2 <= e2.lookahead ? a2 : e2.lookahead;
          }
          function j(e2) {
            var t2, r2, n2, i2, s2, a2, o2, h2, u2, l2, f2 = e2.w_size;
            do {
              if (i2 = e2.window_size - e2.lookahead - e2.strstart, e2.strstart >= f2 + (f2 - z)) {
                for (c.arraySet(e2.window, e2.window, f2, f2, 0), e2.match_start -= f2, e2.strstart -= f2, e2.block_start -= f2, t2 = r2 = e2.hash_size; n2 = e2.head[--t2], e2.head[t2] = f2 <= n2 ? n2 - f2 : 0, --r2; ) ;
                for (t2 = r2 = f2; n2 = e2.prev[--t2], e2.prev[t2] = f2 <= n2 ? n2 - f2 : 0, --r2; ) ;
                i2 += f2;
              }
              if (0 === e2.strm.avail_in) break;
              if (a2 = e2.strm, o2 = e2.window, h2 = e2.strstart + e2.lookahead, u2 = i2, l2 = void 0, l2 = a2.avail_in, u2 < l2 && (l2 = u2), r2 = 0 === l2 ? 0 : (a2.avail_in -= l2, c.arraySet(o2, a2.input, a2.next_in, l2, h2), 1 === a2.state.wrap ? a2.adler = d(a2.adler, o2, l2, h2) : 2 === a2.state.wrap && (a2.adler = p(a2.adler, o2, l2, h2)), a2.next_in += l2, a2.total_in += l2, l2), e2.lookahead += r2, e2.lookahead + e2.insert >= x) for (s2 = e2.strstart - e2.insert, e2.ins_h = e2.window[s2], e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[s2 + 1]) & e2.hash_mask; e2.insert && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[s2 + x - 1]) & e2.hash_mask, e2.prev[s2 & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = s2, s2++, e2.insert--, !(e2.lookahead + e2.insert < x)); ) ;
            } while (e2.lookahead < z && 0 !== e2.strm.avail_in);
          }
          function Z(e2, t2) {
            for (var r2, n2; ; ) {
              if (e2.lookahead < z) {
                if (j(e2), e2.lookahead < z && t2 === l) return A;
                if (0 === e2.lookahead) break;
              }
              if (r2 = 0, e2.lookahead >= x && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), 0 !== r2 && e2.strstart - r2 <= e2.w_size - z && (e2.match_length = L(e2, r2)), e2.match_length >= x) if (n2 = u._tr_tally(e2, e2.strstart - e2.match_start, e2.match_length - x), e2.lookahead -= e2.match_length, e2.match_length <= e2.max_lazy_match && e2.lookahead >= x) {
                for (e2.match_length--; e2.strstart++, e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart, 0 != --e2.match_length; ) ;
                e2.strstart++;
              } else e2.strstart += e2.match_length, e2.match_length = 0, e2.ins_h = e2.window[e2.strstart], e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + 1]) & e2.hash_mask;
              else n2 = u._tr_tally(e2, 0, e2.window[e2.strstart]), e2.lookahead--, e2.strstart++;
              if (n2 && (N(e2, false), 0 === e2.strm.avail_out)) return A;
            }
            return e2.insert = e2.strstart < x - 1 ? e2.strstart : x - 1, t2 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : e2.last_lit && (N(e2, false), 0 === e2.strm.avail_out) ? A : I;
          }
          function W(e2, t2) {
            for (var r2, n2, i2; ; ) {
              if (e2.lookahead < z) {
                if (j(e2), e2.lookahead < z && t2 === l) return A;
                if (0 === e2.lookahead) break;
              }
              if (r2 = 0, e2.lookahead >= x && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), e2.prev_length = e2.match_length, e2.prev_match = e2.match_start, e2.match_length = x - 1, 0 !== r2 && e2.prev_length < e2.max_lazy_match && e2.strstart - r2 <= e2.w_size - z && (e2.match_length = L(e2, r2), e2.match_length <= 5 && (1 === e2.strategy || e2.match_length === x && 4096 < e2.strstart - e2.match_start) && (e2.match_length = x - 1)), e2.prev_length >= x && e2.match_length <= e2.prev_length) {
                for (i2 = e2.strstart + e2.lookahead - x, n2 = u._tr_tally(e2, e2.strstart - 1 - e2.prev_match, e2.prev_length - x), e2.lookahead -= e2.prev_length - 1, e2.prev_length -= 2; ++e2.strstart <= i2 && (e2.ins_h = (e2.ins_h << e2.hash_shift ^ e2.window[e2.strstart + x - 1]) & e2.hash_mask, r2 = e2.prev[e2.strstart & e2.w_mask] = e2.head[e2.ins_h], e2.head[e2.ins_h] = e2.strstart), 0 != --e2.prev_length; ) ;
                if (e2.match_available = 0, e2.match_length = x - 1, e2.strstart++, n2 && (N(e2, false), 0 === e2.strm.avail_out)) return A;
              } else if (e2.match_available) {
                if ((n2 = u._tr_tally(e2, 0, e2.window[e2.strstart - 1])) && N(e2, false), e2.strstart++, e2.lookahead--, 0 === e2.strm.avail_out) return A;
              } else e2.match_available = 1, e2.strstart++, e2.lookahead--;
            }
            return e2.match_available && (n2 = u._tr_tally(e2, 0, e2.window[e2.strstart - 1]), e2.match_available = 0), e2.insert = e2.strstart < x - 1 ? e2.strstart : x - 1, t2 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : e2.last_lit && (N(e2, false), 0 === e2.strm.avail_out) ? A : I;
          }
          function M(e2, t2, r2, n2, i2) {
            this.good_length = e2, this.max_lazy = t2, this.nice_length = r2, this.max_chain = n2, this.func = i2;
          }
          function H() {
            this.strm = null, this.status = 0, this.pending_buf = null, this.pending_buf_size = 0, this.pending_out = 0, this.pending = 0, this.wrap = 0, this.gzhead = null, this.gzindex = 0, this.method = v, this.last_flush = -1, this.w_size = 0, this.w_bits = 0, this.w_mask = 0, this.window = null, this.window_size = 0, this.prev = null, this.head = null, this.ins_h = 0, this.hash_size = 0, this.hash_bits = 0, this.hash_mask = 0, this.hash_shift = 0, this.block_start = 0, this.match_length = 0, this.prev_match = 0, this.match_available = 0, this.strstart = 0, this.match_start = 0, this.lookahead = 0, this.prev_length = 0, this.max_chain_length = 0, this.max_lazy_match = 0, this.level = 0, this.strategy = 0, this.good_match = 0, this.nice_match = 0, this.dyn_ltree = new c.Buf16(2 * w), this.dyn_dtree = new c.Buf16(2 * (2 * a + 1)), this.bl_tree = new c.Buf16(2 * (2 * o + 1)), D(this.dyn_ltree), D(this.dyn_dtree), D(this.bl_tree), this.l_desc = null, this.d_desc = null, this.bl_desc = null, this.bl_count = new c.Buf16(k + 1), this.heap = new c.Buf16(2 * s + 1), D(this.heap), this.heap_len = 0, this.heap_max = 0, this.depth = new c.Buf16(2 * s + 1), D(this.depth), this.l_buf = 0, this.lit_bufsize = 0, this.last_lit = 0, this.d_buf = 0, this.opt_len = 0, this.static_len = 0, this.matches = 0, this.insert = 0, this.bi_buf = 0, this.bi_valid = 0;
          }
          function G(e2) {
            var t2;
            return e2 && e2.state ? (e2.total_in = e2.total_out = 0, e2.data_type = i, (t2 = e2.state).pending = 0, t2.pending_out = 0, t2.wrap < 0 && (t2.wrap = -t2.wrap), t2.status = t2.wrap ? C : E, e2.adler = 2 === t2.wrap ? 0 : 1, t2.last_flush = l, u._tr_init(t2), m) : R(e2, _);
          }
          function K(e2) {
            var t2 = G(e2);
            return t2 === m && (function(e3) {
              e3.window_size = 2 * e3.w_size, D(e3.head), e3.max_lazy_match = h[e3.level].max_lazy, e3.good_match = h[e3.level].good_length, e3.nice_match = h[e3.level].nice_length, e3.max_chain_length = h[e3.level].max_chain, e3.strstart = 0, e3.block_start = 0, e3.lookahead = 0, e3.insert = 0, e3.match_length = e3.prev_length = x - 1, e3.match_available = 0, e3.ins_h = 0;
            })(e2.state), t2;
          }
          function Y(e2, t2, r2, n2, i2, s2) {
            if (!e2) return _;
            var a2 = 1;
            if (t2 === g && (t2 = 6), n2 < 0 ? (a2 = 0, n2 = -n2) : 15 < n2 && (a2 = 2, n2 -= 16), i2 < 1 || y < i2 || r2 !== v || n2 < 8 || 15 < n2 || t2 < 0 || 9 < t2 || s2 < 0 || b < s2) return R(e2, _);
            8 === n2 && (n2 = 9);
            var o2 = new H();
            return (e2.state = o2).strm = e2, o2.wrap = a2, o2.gzhead = null, o2.w_bits = n2, o2.w_size = 1 << o2.w_bits, o2.w_mask = o2.w_size - 1, o2.hash_bits = i2 + 7, o2.hash_size = 1 << o2.hash_bits, o2.hash_mask = o2.hash_size - 1, o2.hash_shift = ~~((o2.hash_bits + x - 1) / x), o2.window = new c.Buf8(2 * o2.w_size), o2.head = new c.Buf16(o2.hash_size), o2.prev = new c.Buf16(o2.w_size), o2.lit_bufsize = 1 << i2 + 6, o2.pending_buf_size = 4 * o2.lit_bufsize, o2.pending_buf = new c.Buf8(o2.pending_buf_size), o2.d_buf = 1 * o2.lit_bufsize, o2.l_buf = 3 * o2.lit_bufsize, o2.level = t2, o2.strategy = s2, o2.method = r2, K(e2);
          }
          h = [new M(0, 0, 0, 0, function(e2, t2) {
            var r2 = 65535;
            for (r2 > e2.pending_buf_size - 5 && (r2 = e2.pending_buf_size - 5); ; ) {
              if (e2.lookahead <= 1) {
                if (j(e2), 0 === e2.lookahead && t2 === l) return A;
                if (0 === e2.lookahead) break;
              }
              e2.strstart += e2.lookahead, e2.lookahead = 0;
              var n2 = e2.block_start + r2;
              if ((0 === e2.strstart || e2.strstart >= n2) && (e2.lookahead = e2.strstart - n2, e2.strstart = n2, N(e2, false), 0 === e2.strm.avail_out)) return A;
              if (e2.strstart - e2.block_start >= e2.w_size - z && (N(e2, false), 0 === e2.strm.avail_out)) return A;
            }
            return e2.insert = 0, t2 === f ? (N(e2, true), 0 === e2.strm.avail_out ? O : B) : (e2.strstart > e2.block_start && (N(e2, false), e2.strm.avail_out), A);
          }), new M(4, 4, 8, 4, Z), new M(4, 5, 16, 8, Z), new M(4, 6, 32, 32, Z), new M(4, 4, 16, 16, W), new M(8, 16, 32, 32, W), new M(8, 16, 128, 128, W), new M(8, 32, 128, 256, W), new M(32, 128, 258, 1024, W), new M(32, 258, 258, 4096, W)], r.deflateInit = function(e2, t2) {
            return Y(e2, t2, v, 15, 8, 0);
          }, r.deflateInit2 = Y, r.deflateReset = K, r.deflateResetKeep = G, r.deflateSetHeader = function(e2, t2) {
            return e2 && e2.state ? 2 !== e2.state.wrap ? _ : (e2.state.gzhead = t2, m) : _;
          }, r.deflate = function(e2, t2) {
            var r2, n2, i2, s2;
            if (!e2 || !e2.state || 5 < t2 || t2 < 0) return e2 ? R(e2, _) : _;
            if (n2 = e2.state, !e2.output || !e2.input && 0 !== e2.avail_in || 666 === n2.status && t2 !== f) return R(e2, 0 === e2.avail_out ? -5 : _);
            if (n2.strm = e2, r2 = n2.last_flush, n2.last_flush = t2, n2.status === C) if (2 === n2.wrap) e2.adler = 0, U(n2, 31), U(n2, 139), U(n2, 8), n2.gzhead ? (U(n2, (n2.gzhead.text ? 1 : 0) + (n2.gzhead.hcrc ? 2 : 0) + (n2.gzhead.extra ? 4 : 0) + (n2.gzhead.name ? 8 : 0) + (n2.gzhead.comment ? 16 : 0)), U(n2, 255 & n2.gzhead.time), U(n2, n2.gzhead.time >> 8 & 255), U(n2, n2.gzhead.time >> 16 & 255), U(n2, n2.gzhead.time >> 24 & 255), U(n2, 9 === n2.level ? 2 : 2 <= n2.strategy || n2.level < 2 ? 4 : 0), U(n2, 255 & n2.gzhead.os), n2.gzhead.extra && n2.gzhead.extra.length && (U(n2, 255 & n2.gzhead.extra.length), U(n2, n2.gzhead.extra.length >> 8 & 255)), n2.gzhead.hcrc && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending, 0)), n2.gzindex = 0, n2.status = 69) : (U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 0), U(n2, 9 === n2.level ? 2 : 2 <= n2.strategy || n2.level < 2 ? 4 : 0), U(n2, 3), n2.status = E);
            else {
              var a2 = v + (n2.w_bits - 8 << 4) << 8;
              a2 |= (2 <= n2.strategy || n2.level < 2 ? 0 : n2.level < 6 ? 1 : 6 === n2.level ? 2 : 3) << 6, 0 !== n2.strstart && (a2 |= 32), a2 += 31 - a2 % 31, n2.status = E, P(n2, a2), 0 !== n2.strstart && (P(n2, e2.adler >>> 16), P(n2, 65535 & e2.adler)), e2.adler = 1;
            }
            if (69 === n2.status) if (n2.gzhead.extra) {
              for (i2 = n2.pending; n2.gzindex < (65535 & n2.gzhead.extra.length) && (n2.pending !== n2.pending_buf_size || (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending !== n2.pending_buf_size)); ) U(n2, 255 & n2.gzhead.extra[n2.gzindex]), n2.gzindex++;
              n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), n2.gzindex === n2.gzhead.extra.length && (n2.gzindex = 0, n2.status = 73);
            } else n2.status = 73;
            if (73 === n2.status) if (n2.gzhead.name) {
              i2 = n2.pending;
              do {
                if (n2.pending === n2.pending_buf_size && (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending === n2.pending_buf_size)) {
                  s2 = 1;
                  break;
                }
                s2 = n2.gzindex < n2.gzhead.name.length ? 255 & n2.gzhead.name.charCodeAt(n2.gzindex++) : 0, U(n2, s2);
              } while (0 !== s2);
              n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), 0 === s2 && (n2.gzindex = 0, n2.status = 91);
            } else n2.status = 91;
            if (91 === n2.status) if (n2.gzhead.comment) {
              i2 = n2.pending;
              do {
                if (n2.pending === n2.pending_buf_size && (n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), F(e2), i2 = n2.pending, n2.pending === n2.pending_buf_size)) {
                  s2 = 1;
                  break;
                }
                s2 = n2.gzindex < n2.gzhead.comment.length ? 255 & n2.gzhead.comment.charCodeAt(n2.gzindex++) : 0, U(n2, s2);
              } while (0 !== s2);
              n2.gzhead.hcrc && n2.pending > i2 && (e2.adler = p(e2.adler, n2.pending_buf, n2.pending - i2, i2)), 0 === s2 && (n2.status = 103);
            } else n2.status = 103;
            if (103 === n2.status && (n2.gzhead.hcrc ? (n2.pending + 2 > n2.pending_buf_size && F(e2), n2.pending + 2 <= n2.pending_buf_size && (U(n2, 255 & e2.adler), U(n2, e2.adler >> 8 & 255), e2.adler = 0, n2.status = E)) : n2.status = E), 0 !== n2.pending) {
              if (F(e2), 0 === e2.avail_out) return n2.last_flush = -1, m;
            } else if (0 === e2.avail_in && T(t2) <= T(r2) && t2 !== f) return R(e2, -5);
            if (666 === n2.status && 0 !== e2.avail_in) return R(e2, -5);
            if (0 !== e2.avail_in || 0 !== n2.lookahead || t2 !== l && 666 !== n2.status) {
              var o2 = 2 === n2.strategy ? (function(e3, t3) {
                for (var r3; ; ) {
                  if (0 === e3.lookahead && (j(e3), 0 === e3.lookahead)) {
                    if (t3 === l) return A;
                    break;
                  }
                  if (e3.match_length = 0, r3 = u._tr_tally(e3, 0, e3.window[e3.strstart]), e3.lookahead--, e3.strstart++, r3 && (N(e3, false), 0 === e3.strm.avail_out)) return A;
                }
                return e3.insert = 0, t3 === f ? (N(e3, true), 0 === e3.strm.avail_out ? O : B) : e3.last_lit && (N(e3, false), 0 === e3.strm.avail_out) ? A : I;
              })(n2, t2) : 3 === n2.strategy ? (function(e3, t3) {
                for (var r3, n3, i3, s3, a3 = e3.window; ; ) {
                  if (e3.lookahead <= S) {
                    if (j(e3), e3.lookahead <= S && t3 === l) return A;
                    if (0 === e3.lookahead) break;
                  }
                  if (e3.match_length = 0, e3.lookahead >= x && 0 < e3.strstart && (n3 = a3[i3 = e3.strstart - 1]) === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3]) {
                    s3 = e3.strstart + S;
                    do {
                    } while (n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && n3 === a3[++i3] && i3 < s3);
                    e3.match_length = S - (s3 - i3), e3.match_length > e3.lookahead && (e3.match_length = e3.lookahead);
                  }
                  if (e3.match_length >= x ? (r3 = u._tr_tally(e3, 1, e3.match_length - x), e3.lookahead -= e3.match_length, e3.strstart += e3.match_length, e3.match_length = 0) : (r3 = u._tr_tally(e3, 0, e3.window[e3.strstart]), e3.lookahead--, e3.strstart++), r3 && (N(e3, false), 0 === e3.strm.avail_out)) return A;
                }
                return e3.insert = 0, t3 === f ? (N(e3, true), 0 === e3.strm.avail_out ? O : B) : e3.last_lit && (N(e3, false), 0 === e3.strm.avail_out) ? A : I;
              })(n2, t2) : h[n2.level].func(n2, t2);
              if (o2 !== O && o2 !== B || (n2.status = 666), o2 === A || o2 === O) return 0 === e2.avail_out && (n2.last_flush = -1), m;
              if (o2 === I && (1 === t2 ? u._tr_align(n2) : 5 !== t2 && (u._tr_stored_block(n2, 0, 0, false), 3 === t2 && (D(n2.head), 0 === n2.lookahead && (n2.strstart = 0, n2.block_start = 0, n2.insert = 0))), F(e2), 0 === e2.avail_out)) return n2.last_flush = -1, m;
            }
            return t2 !== f ? m : n2.wrap <= 0 ? 1 : (2 === n2.wrap ? (U(n2, 255 & e2.adler), U(n2, e2.adler >> 8 & 255), U(n2, e2.adler >> 16 & 255), U(n2, e2.adler >> 24 & 255), U(n2, 255 & e2.total_in), U(n2, e2.total_in >> 8 & 255), U(n2, e2.total_in >> 16 & 255), U(n2, e2.total_in >> 24 & 255)) : (P(n2, e2.adler >>> 16), P(n2, 65535 & e2.adler)), F(e2), 0 < n2.wrap && (n2.wrap = -n2.wrap), 0 !== n2.pending ? m : 1);
          }, r.deflateEnd = function(e2) {
            var t2;
            return e2 && e2.state ? (t2 = e2.state.status) !== C && 69 !== t2 && 73 !== t2 && 91 !== t2 && 103 !== t2 && t2 !== E && 666 !== t2 ? R(e2, _) : (e2.state = null, t2 === E ? R(e2, -3) : m) : _;
          }, r.deflateSetDictionary = function(e2, t2) {
            var r2, n2, i2, s2, a2, o2, h2, u2, l2 = t2.length;
            if (!e2 || !e2.state) return _;
            if (2 === (s2 = (r2 = e2.state).wrap) || 1 === s2 && r2.status !== C || r2.lookahead) return _;
            for (1 === s2 && (e2.adler = d(e2.adler, t2, l2, 0)), r2.wrap = 0, l2 >= r2.w_size && (0 === s2 && (D(r2.head), r2.strstart = 0, r2.block_start = 0, r2.insert = 0), u2 = new c.Buf8(r2.w_size), c.arraySet(u2, t2, l2 - r2.w_size, r2.w_size, 0), t2 = u2, l2 = r2.w_size), a2 = e2.avail_in, o2 = e2.next_in, h2 = e2.input, e2.avail_in = l2, e2.next_in = 0, e2.input = t2, j(r2); r2.lookahead >= x; ) {
              for (n2 = r2.strstart, i2 = r2.lookahead - (x - 1); r2.ins_h = (r2.ins_h << r2.hash_shift ^ r2.window[n2 + x - 1]) & r2.hash_mask, r2.prev[n2 & r2.w_mask] = r2.head[r2.ins_h], r2.head[r2.ins_h] = n2, n2++, --i2; ) ;
              r2.strstart = n2, r2.lookahead = x - 1, j(r2);
            }
            return r2.strstart += r2.lookahead, r2.block_start = r2.strstart, r2.insert = r2.lookahead, r2.lookahead = 0, r2.match_length = r2.prev_length = x - 1, r2.match_available = 0, e2.next_in = o2, e2.input = h2, e2.avail_in = a2, r2.wrap = s2, m;
          }, r.deflateInfo = "pako deflate (from Nodeca project)";
        }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./messages": 51, "./trees": 52 }], 47: [function(e, t, r) {
          "use strict";
          t.exports = function() {
            this.text = 0, this.time = 0, this.xflags = 0, this.os = 0, this.extra = null, this.extra_len = 0, this.name = "", this.comment = "", this.hcrc = 0, this.done = false;
          };
        }, {}], 48: [function(e, t, r) {
          "use strict";
          t.exports = function(e2, t2) {
            var r2, n, i, s, a, o, h, u, l, f, c, d, p, m, _, g, b, v, y, w, k, x, S, z, C;
            r2 = e2.state, n = e2.next_in, z = e2.input, i = n + (e2.avail_in - 5), s = e2.next_out, C = e2.output, a = s - (t2 - e2.avail_out), o = s + (e2.avail_out - 257), h = r2.dmax, u = r2.wsize, l = r2.whave, f = r2.wnext, c = r2.window, d = r2.hold, p = r2.bits, m = r2.lencode, _ = r2.distcode, g = (1 << r2.lenbits) - 1, b = (1 << r2.distbits) - 1;
            e: do {
              p < 15 && (d += z[n++] << p, p += 8, d += z[n++] << p, p += 8), v = m[d & g];
              t: for (; ; ) {
                if (d >>>= y = v >>> 24, p -= y, 0 === (y = v >>> 16 & 255)) C[s++] = 65535 & v;
                else {
                  if (!(16 & y)) {
                    if (0 == (64 & y)) {
                      v = m[(65535 & v) + (d & (1 << y) - 1)];
                      continue t;
                    }
                    if (32 & y) {
                      r2.mode = 12;
                      break e;
                    }
                    e2.msg = "invalid literal/length code", r2.mode = 30;
                    break e;
                  }
                  w = 65535 & v, (y &= 15) && (p < y && (d += z[n++] << p, p += 8), w += d & (1 << y) - 1, d >>>= y, p -= y), p < 15 && (d += z[n++] << p, p += 8, d += z[n++] << p, p += 8), v = _[d & b];
                  r: for (; ; ) {
                    if (d >>>= y = v >>> 24, p -= y, !(16 & (y = v >>> 16 & 255))) {
                      if (0 == (64 & y)) {
                        v = _[(65535 & v) + (d & (1 << y) - 1)];
                        continue r;
                      }
                      e2.msg = "invalid distance code", r2.mode = 30;
                      break e;
                    }
                    if (k = 65535 & v, p < (y &= 15) && (d += z[n++] << p, (p += 8) < y && (d += z[n++] << p, p += 8)), h < (k += d & (1 << y) - 1)) {
                      e2.msg = "invalid distance too far back", r2.mode = 30;
                      break e;
                    }
                    if (d >>>= y, p -= y, (y = s - a) < k) {
                      if (l < (y = k - y) && r2.sane) {
                        e2.msg = "invalid distance too far back", r2.mode = 30;
                        break e;
                      }
                      if (S = c, (x = 0) === f) {
                        if (x += u - y, y < w) {
                          for (w -= y; C[s++] = c[x++], --y; ) ;
                          x = s - k, S = C;
                        }
                      } else if (f < y) {
                        if (x += u + f - y, (y -= f) < w) {
                          for (w -= y; C[s++] = c[x++], --y; ) ;
                          if (x = 0, f < w) {
                            for (w -= y = f; C[s++] = c[x++], --y; ) ;
                            x = s - k, S = C;
                          }
                        }
                      } else if (x += f - y, y < w) {
                        for (w -= y; C[s++] = c[x++], --y; ) ;
                        x = s - k, S = C;
                      }
                      for (; 2 < w; ) C[s++] = S[x++], C[s++] = S[x++], C[s++] = S[x++], w -= 3;
                      w && (C[s++] = S[x++], 1 < w && (C[s++] = S[x++]));
                    } else {
                      for (x = s - k; C[s++] = C[x++], C[s++] = C[x++], C[s++] = C[x++], 2 < (w -= 3); ) ;
                      w && (C[s++] = C[x++], 1 < w && (C[s++] = C[x++]));
                    }
                    break;
                  }
                }
                break;
              }
            } while (n < i && s < o);
            n -= w = p >> 3, d &= (1 << (p -= w << 3)) - 1, e2.next_in = n, e2.next_out = s, e2.avail_in = n < i ? i - n + 5 : 5 - (n - i), e2.avail_out = s < o ? o - s + 257 : 257 - (s - o), r2.hold = d, r2.bits = p;
          };
        }, {}], 49: [function(e, t, r) {
          "use strict";
          var I = e("../utils/common"), O = e("./adler32"), B = e("./crc32"), R = e("./inffast"), T = e("./inftrees"), D = 1, F = 2, N = 0, U = -2, P = 1, n = 852, i = 592;
          function L(e2) {
            return (e2 >>> 24 & 255) + (e2 >>> 8 & 65280) + ((65280 & e2) << 8) + ((255 & e2) << 24);
          }
          function s() {
            this.mode = 0, this.last = false, this.wrap = 0, this.havedict = false, this.flags = 0, this.dmax = 0, this.check = 0, this.total = 0, this.head = null, this.wbits = 0, this.wsize = 0, this.whave = 0, this.wnext = 0, this.window = null, this.hold = 0, this.bits = 0, this.length = 0, this.offset = 0, this.extra = 0, this.lencode = null, this.distcode = null, this.lenbits = 0, this.distbits = 0, this.ncode = 0, this.nlen = 0, this.ndist = 0, this.have = 0, this.next = null, this.lens = new I.Buf16(320), this.work = new I.Buf16(288), this.lendyn = null, this.distdyn = null, this.sane = 0, this.back = 0, this.was = 0;
          }
          function a(e2) {
            var t2;
            return e2 && e2.state ? (t2 = e2.state, e2.total_in = e2.total_out = t2.total = 0, e2.msg = "", t2.wrap && (e2.adler = 1 & t2.wrap), t2.mode = P, t2.last = 0, t2.havedict = 0, t2.dmax = 32768, t2.head = null, t2.hold = 0, t2.bits = 0, t2.lencode = t2.lendyn = new I.Buf32(n), t2.distcode = t2.distdyn = new I.Buf32(i), t2.sane = 1, t2.back = -1, N) : U;
          }
          function o(e2) {
            var t2;
            return e2 && e2.state ? ((t2 = e2.state).wsize = 0, t2.whave = 0, t2.wnext = 0, a(e2)) : U;
          }
          function h(e2, t2) {
            var r2, n2;
            return e2 && e2.state ? (n2 = e2.state, t2 < 0 ? (r2 = 0, t2 = -t2) : (r2 = 1 + (t2 >> 4), t2 < 48 && (t2 &= 15)), t2 && (t2 < 8 || 15 < t2) ? U : (null !== n2.window && n2.wbits !== t2 && (n2.window = null), n2.wrap = r2, n2.wbits = t2, o(e2))) : U;
          }
          function u(e2, t2) {
            var r2, n2;
            return e2 ? (n2 = new s(), (e2.state = n2).window = null, (r2 = h(e2, t2)) !== N && (e2.state = null), r2) : U;
          }
          var l, f, c = true;
          function j(e2) {
            if (c) {
              var t2;
              for (l = new I.Buf32(512), f = new I.Buf32(32), t2 = 0; t2 < 144; ) e2.lens[t2++] = 8;
              for (; t2 < 256; ) e2.lens[t2++] = 9;
              for (; t2 < 280; ) e2.lens[t2++] = 7;
              for (; t2 < 288; ) e2.lens[t2++] = 8;
              for (T(D, e2.lens, 0, 288, l, 0, e2.work, { bits: 9 }), t2 = 0; t2 < 32; ) e2.lens[t2++] = 5;
              T(F, e2.lens, 0, 32, f, 0, e2.work, { bits: 5 }), c = false;
            }
            e2.lencode = l, e2.lenbits = 9, e2.distcode = f, e2.distbits = 5;
          }
          function Z(e2, t2, r2, n2) {
            var i2, s2 = e2.state;
            return null === s2.window && (s2.wsize = 1 << s2.wbits, s2.wnext = 0, s2.whave = 0, s2.window = new I.Buf8(s2.wsize)), n2 >= s2.wsize ? (I.arraySet(s2.window, t2, r2 - s2.wsize, s2.wsize, 0), s2.wnext = 0, s2.whave = s2.wsize) : (n2 < (i2 = s2.wsize - s2.wnext) && (i2 = n2), I.arraySet(s2.window, t2, r2 - n2, i2, s2.wnext), (n2 -= i2) ? (I.arraySet(s2.window, t2, r2 - n2, n2, 0), s2.wnext = n2, s2.whave = s2.wsize) : (s2.wnext += i2, s2.wnext === s2.wsize && (s2.wnext = 0), s2.whave < s2.wsize && (s2.whave += i2))), 0;
          }
          r.inflateReset = o, r.inflateReset2 = h, r.inflateResetKeep = a, r.inflateInit = function(e2) {
            return u(e2, 15);
          }, r.inflateInit2 = u, r.inflate = function(e2, t2) {
            var r2, n2, i2, s2, a2, o2, h2, u2, l2, f2, c2, d, p, m, _, g, b, v, y, w, k, x, S, z, C = 0, E = new I.Buf8(4), A = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
            if (!e2 || !e2.state || !e2.output || !e2.input && 0 !== e2.avail_in) return U;
            12 === (r2 = e2.state).mode && (r2.mode = 13), a2 = e2.next_out, i2 = e2.output, h2 = e2.avail_out, s2 = e2.next_in, n2 = e2.input, o2 = e2.avail_in, u2 = r2.hold, l2 = r2.bits, f2 = o2, c2 = h2, x = N;
            e: for (; ; ) switch (r2.mode) {
              case P:
                if (0 === r2.wrap) {
                  r2.mode = 13;
                  break;
                }
                for (; l2 < 16; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if (2 & r2.wrap && 35615 === u2) {
                  E[r2.check = 0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0), l2 = u2 = 0, r2.mode = 2;
                  break;
                }
                if (r2.flags = 0, r2.head && (r2.head.done = false), !(1 & r2.wrap) || (((255 & u2) << 8) + (u2 >> 8)) % 31) {
                  e2.msg = "incorrect header check", r2.mode = 30;
                  break;
                }
                if (8 != (15 & u2)) {
                  e2.msg = "unknown compression method", r2.mode = 30;
                  break;
                }
                if (l2 -= 4, k = 8 + (15 & (u2 >>>= 4)), 0 === r2.wbits) r2.wbits = k;
                else if (k > r2.wbits) {
                  e2.msg = "invalid window size", r2.mode = 30;
                  break;
                }
                r2.dmax = 1 << k, e2.adler = r2.check = 1, r2.mode = 512 & u2 ? 10 : 12, l2 = u2 = 0;
                break;
              case 2:
                for (; l2 < 16; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if (r2.flags = u2, 8 != (255 & r2.flags)) {
                  e2.msg = "unknown compression method", r2.mode = 30;
                  break;
                }
                if (57344 & r2.flags) {
                  e2.msg = "unknown header flags set", r2.mode = 30;
                  break;
                }
                r2.head && (r2.head.text = u2 >> 8 & 1), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0, r2.mode = 3;
              case 3:
                for (; l2 < 32; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                r2.head && (r2.head.time = u2), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, E[2] = u2 >>> 16 & 255, E[3] = u2 >>> 24 & 255, r2.check = B(r2.check, E, 4, 0)), l2 = u2 = 0, r2.mode = 4;
              case 4:
                for (; l2 < 16; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                r2.head && (r2.head.xflags = 255 & u2, r2.head.os = u2 >> 8), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0, r2.mode = 5;
              case 5:
                if (1024 & r2.flags) {
                  for (; l2 < 16; ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  r2.length = u2, r2.head && (r2.head.extra_len = u2), 512 & r2.flags && (E[0] = 255 & u2, E[1] = u2 >>> 8 & 255, r2.check = B(r2.check, E, 2, 0)), l2 = u2 = 0;
                } else r2.head && (r2.head.extra = null);
                r2.mode = 6;
              case 6:
                if (1024 & r2.flags && (o2 < (d = r2.length) && (d = o2), d && (r2.head && (k = r2.head.extra_len - r2.length, r2.head.extra || (r2.head.extra = new Array(r2.head.extra_len)), I.arraySet(r2.head.extra, n2, s2, d, k)), 512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, r2.length -= d), r2.length)) break e;
                r2.length = 0, r2.mode = 7;
              case 7:
                if (2048 & r2.flags) {
                  if (0 === o2) break e;
                  for (d = 0; k = n2[s2 + d++], r2.head && k && r2.length < 65536 && (r2.head.name += String.fromCharCode(k)), k && d < o2; ) ;
                  if (512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, k) break e;
                } else r2.head && (r2.head.name = null);
                r2.length = 0, r2.mode = 8;
              case 8:
                if (4096 & r2.flags) {
                  if (0 === o2) break e;
                  for (d = 0; k = n2[s2 + d++], r2.head && k && r2.length < 65536 && (r2.head.comment += String.fromCharCode(k)), k && d < o2; ) ;
                  if (512 & r2.flags && (r2.check = B(r2.check, n2, d, s2)), o2 -= d, s2 += d, k) break e;
                } else r2.head && (r2.head.comment = null);
                r2.mode = 9;
              case 9:
                if (512 & r2.flags) {
                  for (; l2 < 16; ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  if (u2 !== (65535 & r2.check)) {
                    e2.msg = "header crc mismatch", r2.mode = 30;
                    break;
                  }
                  l2 = u2 = 0;
                }
                r2.head && (r2.head.hcrc = r2.flags >> 9 & 1, r2.head.done = true), e2.adler = r2.check = 0, r2.mode = 12;
                break;
              case 10:
                for (; l2 < 32; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                e2.adler = r2.check = L(u2), l2 = u2 = 0, r2.mode = 11;
              case 11:
                if (0 === r2.havedict) return e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, 2;
                e2.adler = r2.check = 1, r2.mode = 12;
              case 12:
                if (5 === t2 || 6 === t2) break e;
              case 13:
                if (r2.last) {
                  u2 >>>= 7 & l2, l2 -= 7 & l2, r2.mode = 27;
                  break;
                }
                for (; l2 < 3; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                switch (r2.last = 1 & u2, l2 -= 1, 3 & (u2 >>>= 1)) {
                  case 0:
                    r2.mode = 14;
                    break;
                  case 1:
                    if (j(r2), r2.mode = 20, 6 !== t2) break;
                    u2 >>>= 2, l2 -= 2;
                    break e;
                  case 2:
                    r2.mode = 17;
                    break;
                  case 3:
                    e2.msg = "invalid block type", r2.mode = 30;
                }
                u2 >>>= 2, l2 -= 2;
                break;
              case 14:
                for (u2 >>>= 7 & l2, l2 -= 7 & l2; l2 < 32; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if ((65535 & u2) != (u2 >>> 16 ^ 65535)) {
                  e2.msg = "invalid stored block lengths", r2.mode = 30;
                  break;
                }
                if (r2.length = 65535 & u2, l2 = u2 = 0, r2.mode = 15, 6 === t2) break e;
              case 15:
                r2.mode = 16;
              case 16:
                if (d = r2.length) {
                  if (o2 < d && (d = o2), h2 < d && (d = h2), 0 === d) break e;
                  I.arraySet(i2, n2, s2, d, a2), o2 -= d, s2 += d, h2 -= d, a2 += d, r2.length -= d;
                  break;
                }
                r2.mode = 12;
                break;
              case 17:
                for (; l2 < 14; ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if (r2.nlen = 257 + (31 & u2), u2 >>>= 5, l2 -= 5, r2.ndist = 1 + (31 & u2), u2 >>>= 5, l2 -= 5, r2.ncode = 4 + (15 & u2), u2 >>>= 4, l2 -= 4, 286 < r2.nlen || 30 < r2.ndist) {
                  e2.msg = "too many length or distance symbols", r2.mode = 30;
                  break;
                }
                r2.have = 0, r2.mode = 18;
              case 18:
                for (; r2.have < r2.ncode; ) {
                  for (; l2 < 3; ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  r2.lens[A[r2.have++]] = 7 & u2, u2 >>>= 3, l2 -= 3;
                }
                for (; r2.have < 19; ) r2.lens[A[r2.have++]] = 0;
                if (r2.lencode = r2.lendyn, r2.lenbits = 7, S = { bits: r2.lenbits }, x = T(0, r2.lens, 0, 19, r2.lencode, 0, r2.work, S), r2.lenbits = S.bits, x) {
                  e2.msg = "invalid code lengths set", r2.mode = 30;
                  break;
                }
                r2.have = 0, r2.mode = 19;
              case 19:
                for (; r2.have < r2.nlen + r2.ndist; ) {
                  for (; g = (C = r2.lencode[u2 & (1 << r2.lenbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  if (b < 16) u2 >>>= _, l2 -= _, r2.lens[r2.have++] = b;
                  else {
                    if (16 === b) {
                      for (z = _ + 2; l2 < z; ) {
                        if (0 === o2) break e;
                        o2--, u2 += n2[s2++] << l2, l2 += 8;
                      }
                      if (u2 >>>= _, l2 -= _, 0 === r2.have) {
                        e2.msg = "invalid bit length repeat", r2.mode = 30;
                        break;
                      }
                      k = r2.lens[r2.have - 1], d = 3 + (3 & u2), u2 >>>= 2, l2 -= 2;
                    } else if (17 === b) {
                      for (z = _ + 3; l2 < z; ) {
                        if (0 === o2) break e;
                        o2--, u2 += n2[s2++] << l2, l2 += 8;
                      }
                      l2 -= _, k = 0, d = 3 + (7 & (u2 >>>= _)), u2 >>>= 3, l2 -= 3;
                    } else {
                      for (z = _ + 7; l2 < z; ) {
                        if (0 === o2) break e;
                        o2--, u2 += n2[s2++] << l2, l2 += 8;
                      }
                      l2 -= _, k = 0, d = 11 + (127 & (u2 >>>= _)), u2 >>>= 7, l2 -= 7;
                    }
                    if (r2.have + d > r2.nlen + r2.ndist) {
                      e2.msg = "invalid bit length repeat", r2.mode = 30;
                      break;
                    }
                    for (; d--; ) r2.lens[r2.have++] = k;
                  }
                }
                if (30 === r2.mode) break;
                if (0 === r2.lens[256]) {
                  e2.msg = "invalid code -- missing end-of-block", r2.mode = 30;
                  break;
                }
                if (r2.lenbits = 9, S = { bits: r2.lenbits }, x = T(D, r2.lens, 0, r2.nlen, r2.lencode, 0, r2.work, S), r2.lenbits = S.bits, x) {
                  e2.msg = "invalid literal/lengths set", r2.mode = 30;
                  break;
                }
                if (r2.distbits = 6, r2.distcode = r2.distdyn, S = { bits: r2.distbits }, x = T(F, r2.lens, r2.nlen, r2.ndist, r2.distcode, 0, r2.work, S), r2.distbits = S.bits, x) {
                  e2.msg = "invalid distances set", r2.mode = 30;
                  break;
                }
                if (r2.mode = 20, 6 === t2) break e;
              case 20:
                r2.mode = 21;
              case 21:
                if (6 <= o2 && 258 <= h2) {
                  e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, R(e2, c2), a2 = e2.next_out, i2 = e2.output, h2 = e2.avail_out, s2 = e2.next_in, n2 = e2.input, o2 = e2.avail_in, u2 = r2.hold, l2 = r2.bits, 12 === r2.mode && (r2.back = -1);
                  break;
                }
                for (r2.back = 0; g = (C = r2.lencode[u2 & (1 << r2.lenbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if (g && 0 == (240 & g)) {
                  for (v = _, y = g, w = b; g = (C = r2.lencode[w + ((u2 & (1 << v + y) - 1) >> v)]) >>> 16 & 255, b = 65535 & C, !(v + (_ = C >>> 24) <= l2); ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  u2 >>>= v, l2 -= v, r2.back += v;
                }
                if (u2 >>>= _, l2 -= _, r2.back += _, r2.length = b, 0 === g) {
                  r2.mode = 26;
                  break;
                }
                if (32 & g) {
                  r2.back = -1, r2.mode = 12;
                  break;
                }
                if (64 & g) {
                  e2.msg = "invalid literal/length code", r2.mode = 30;
                  break;
                }
                r2.extra = 15 & g, r2.mode = 22;
              case 22:
                if (r2.extra) {
                  for (z = r2.extra; l2 < z; ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  r2.length += u2 & (1 << r2.extra) - 1, u2 >>>= r2.extra, l2 -= r2.extra, r2.back += r2.extra;
                }
                r2.was = r2.length, r2.mode = 23;
              case 23:
                for (; g = (C = r2.distcode[u2 & (1 << r2.distbits) - 1]) >>> 16 & 255, b = 65535 & C, !((_ = C >>> 24) <= l2); ) {
                  if (0 === o2) break e;
                  o2--, u2 += n2[s2++] << l2, l2 += 8;
                }
                if (0 == (240 & g)) {
                  for (v = _, y = g, w = b; g = (C = r2.distcode[w + ((u2 & (1 << v + y) - 1) >> v)]) >>> 16 & 255, b = 65535 & C, !(v + (_ = C >>> 24) <= l2); ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  u2 >>>= v, l2 -= v, r2.back += v;
                }
                if (u2 >>>= _, l2 -= _, r2.back += _, 64 & g) {
                  e2.msg = "invalid distance code", r2.mode = 30;
                  break;
                }
                r2.offset = b, r2.extra = 15 & g, r2.mode = 24;
              case 24:
                if (r2.extra) {
                  for (z = r2.extra; l2 < z; ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  r2.offset += u2 & (1 << r2.extra) - 1, u2 >>>= r2.extra, l2 -= r2.extra, r2.back += r2.extra;
                }
                if (r2.offset > r2.dmax) {
                  e2.msg = "invalid distance too far back", r2.mode = 30;
                  break;
                }
                r2.mode = 25;
              case 25:
                if (0 === h2) break e;
                if (d = c2 - h2, r2.offset > d) {
                  if ((d = r2.offset - d) > r2.whave && r2.sane) {
                    e2.msg = "invalid distance too far back", r2.mode = 30;
                    break;
                  }
                  p = d > r2.wnext ? (d -= r2.wnext, r2.wsize - d) : r2.wnext - d, d > r2.length && (d = r2.length), m = r2.window;
                } else m = i2, p = a2 - r2.offset, d = r2.length;
                for (h2 < d && (d = h2), h2 -= d, r2.length -= d; i2[a2++] = m[p++], --d; ) ;
                0 === r2.length && (r2.mode = 21);
                break;
              case 26:
                if (0 === h2) break e;
                i2[a2++] = r2.length, h2--, r2.mode = 21;
                break;
              case 27:
                if (r2.wrap) {
                  for (; l2 < 32; ) {
                    if (0 === o2) break e;
                    o2--, u2 |= n2[s2++] << l2, l2 += 8;
                  }
                  if (c2 -= h2, e2.total_out += c2, r2.total += c2, c2 && (e2.adler = r2.check = r2.flags ? B(r2.check, i2, c2, a2 - c2) : O(r2.check, i2, c2, a2 - c2)), c2 = h2, (r2.flags ? u2 : L(u2)) !== r2.check) {
                    e2.msg = "incorrect data check", r2.mode = 30;
                    break;
                  }
                  l2 = u2 = 0;
                }
                r2.mode = 28;
              case 28:
                if (r2.wrap && r2.flags) {
                  for (; l2 < 32; ) {
                    if (0 === o2) break e;
                    o2--, u2 += n2[s2++] << l2, l2 += 8;
                  }
                  if (u2 !== (4294967295 & r2.total)) {
                    e2.msg = "incorrect length check", r2.mode = 30;
                    break;
                  }
                  l2 = u2 = 0;
                }
                r2.mode = 29;
              case 29:
                x = 1;
                break e;
              case 30:
                x = -3;
                break e;
              case 31:
                return -4;
              case 32:
              default:
                return U;
            }
            return e2.next_out = a2, e2.avail_out = h2, e2.next_in = s2, e2.avail_in = o2, r2.hold = u2, r2.bits = l2, (r2.wsize || c2 !== e2.avail_out && r2.mode < 30 && (r2.mode < 27 || 4 !== t2)) && Z(e2, e2.output, e2.next_out, c2 - e2.avail_out) ? (r2.mode = 31, -4) : (f2 -= e2.avail_in, c2 -= e2.avail_out, e2.total_in += f2, e2.total_out += c2, r2.total += c2, r2.wrap && c2 && (e2.adler = r2.check = r2.flags ? B(r2.check, i2, c2, e2.next_out - c2) : O(r2.check, i2, c2, e2.next_out - c2)), e2.data_type = r2.bits + (r2.last ? 64 : 0) + (12 === r2.mode ? 128 : 0) + (20 === r2.mode || 15 === r2.mode ? 256 : 0), (0 == f2 && 0 === c2 || 4 === t2) && x === N && (x = -5), x);
          }, r.inflateEnd = function(e2) {
            if (!e2 || !e2.state) return U;
            var t2 = e2.state;
            return t2.window && (t2.window = null), e2.state = null, N;
          }, r.inflateGetHeader = function(e2, t2) {
            var r2;
            return e2 && e2.state ? 0 == (2 & (r2 = e2.state).wrap) ? U : ((r2.head = t2).done = false, N) : U;
          }, r.inflateSetDictionary = function(e2, t2) {
            var r2, n2 = t2.length;
            return e2 && e2.state ? 0 !== (r2 = e2.state).wrap && 11 !== r2.mode ? U : 11 === r2.mode && O(1, t2, n2, 0) !== r2.check ? -3 : Z(e2, t2, n2, n2) ? (r2.mode = 31, -4) : (r2.havedict = 1, N) : U;
          }, r.inflateInfo = "pako inflate (from Nodeca project)";
        }, { "../utils/common": 41, "./adler32": 43, "./crc32": 45, "./inffast": 48, "./inftrees": 50 }], 50: [function(e, t, r) {
          "use strict";
          var D = e("../utils/common"), F = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 0, 0], N = [16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21, 16, 72, 78], U = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0], P = [16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26, 27, 27, 28, 28, 29, 29, 64, 64];
          t.exports = function(e2, t2, r2, n, i, s, a, o) {
            var h, u, l, f, c, d, p, m, _, g = o.bits, b = 0, v = 0, y = 0, w = 0, k = 0, x = 0, S = 0, z = 0, C = 0, E = 0, A = null, I = 0, O = new D.Buf16(16), B = new D.Buf16(16), R = null, T = 0;
            for (b = 0; b <= 15; b++) O[b] = 0;
            for (v = 0; v < n; v++) O[t2[r2 + v]]++;
            for (k = g, w = 15; 1 <= w && 0 === O[w]; w--) ;
            if (w < k && (k = w), 0 === w) return i[s++] = 20971520, i[s++] = 20971520, o.bits = 1, 0;
            for (y = 1; y < w && 0 === O[y]; y++) ;
            for (k < y && (k = y), b = z = 1; b <= 15; b++) if (z <<= 1, (z -= O[b]) < 0) return -1;
            if (0 < z && (0 === e2 || 1 !== w)) return -1;
            for (B[1] = 0, b = 1; b < 15; b++) B[b + 1] = B[b] + O[b];
            for (v = 0; v < n; v++) 0 !== t2[r2 + v] && (a[B[t2[r2 + v]]++] = v);
            if (d = 0 === e2 ? (A = R = a, 19) : 1 === e2 ? (A = F, I -= 257, R = N, T -= 257, 256) : (A = U, R = P, -1), b = y, c = s, S = v = E = 0, l = -1, f = (C = 1 << (x = k)) - 1, 1 === e2 && 852 < C || 2 === e2 && 592 < C) return 1;
            for (; ; ) {
              for (p = b - S, _ = a[v] < d ? (m = 0, a[v]) : a[v] > d ? (m = R[T + a[v]], A[I + a[v]]) : (m = 96, 0), h = 1 << b - S, y = u = 1 << x; i[c + (E >> S) + (u -= h)] = p << 24 | m << 16 | _ | 0, 0 !== u; ) ;
              for (h = 1 << b - 1; E & h; ) h >>= 1;
              if (0 !== h ? (E &= h - 1, E += h) : E = 0, v++, 0 == --O[b]) {
                if (b === w) break;
                b = t2[r2 + a[v]];
              }
              if (k < b && (E & f) !== l) {
                for (0 === S && (S = k), c += y, z = 1 << (x = b - S); x + S < w && !((z -= O[x + S]) <= 0); ) x++, z <<= 1;
                if (C += 1 << x, 1 === e2 && 852 < C || 2 === e2 && 592 < C) return 1;
                i[l = E & f] = k << 24 | x << 16 | c - s | 0;
              }
            }
            return 0 !== E && (i[c + E] = b - S << 24 | 64 << 16 | 0), o.bits = k, 0;
          };
        }, { "../utils/common": 41 }], 51: [function(e, t, r) {
          "use strict";
          t.exports = { 2: "need dictionary", 1: "stream end", 0: "", "-1": "file error", "-2": "stream error", "-3": "data error", "-4": "insufficient memory", "-5": "buffer error", "-6": "incompatible version" };
        }, {}], 52: [function(e, t, r) {
          "use strict";
          var i = e("../utils/common"), o = 0, h = 1;
          function n(e2) {
            for (var t2 = e2.length; 0 <= --t2; ) e2[t2] = 0;
          }
          var s = 0, a = 29, u = 256, l = u + 1 + a, f = 30, c = 19, _ = 2 * l + 1, g = 15, d = 16, p = 7, m = 256, b = 16, v = 17, y = 18, w = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0], k = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13], x = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7], S = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15], z = new Array(2 * (l + 2));
          n(z);
          var C = new Array(2 * f);
          n(C);
          var E = new Array(512);
          n(E);
          var A = new Array(256);
          n(A);
          var I = new Array(a);
          n(I);
          var O, B, R, T = new Array(f);
          function D(e2, t2, r2, n2, i2) {
            this.static_tree = e2, this.extra_bits = t2, this.extra_base = r2, this.elems = n2, this.max_length = i2, this.has_stree = e2 && e2.length;
          }
          function F(e2, t2) {
            this.dyn_tree = e2, this.max_code = 0, this.stat_desc = t2;
          }
          function N(e2) {
            return e2 < 256 ? E[e2] : E[256 + (e2 >>> 7)];
          }
          function U(e2, t2) {
            e2.pending_buf[e2.pending++] = 255 & t2, e2.pending_buf[e2.pending++] = t2 >>> 8 & 255;
          }
          function P(e2, t2, r2) {
            e2.bi_valid > d - r2 ? (e2.bi_buf |= t2 << e2.bi_valid & 65535, U(e2, e2.bi_buf), e2.bi_buf = t2 >> d - e2.bi_valid, e2.bi_valid += r2 - d) : (e2.bi_buf |= t2 << e2.bi_valid & 65535, e2.bi_valid += r2);
          }
          function L(e2, t2, r2) {
            P(e2, r2[2 * t2], r2[2 * t2 + 1]);
          }
          function j(e2, t2) {
            for (var r2 = 0; r2 |= 1 & e2, e2 >>>= 1, r2 <<= 1, 0 < --t2; ) ;
            return r2 >>> 1;
          }
          function Z(e2, t2, r2) {
            var n2, i2, s2 = new Array(g + 1), a2 = 0;
            for (n2 = 1; n2 <= g; n2++) s2[n2] = a2 = a2 + r2[n2 - 1] << 1;
            for (i2 = 0; i2 <= t2; i2++) {
              var o2 = e2[2 * i2 + 1];
              0 !== o2 && (e2[2 * i2] = j(s2[o2]++, o2));
            }
          }
          function W(e2) {
            var t2;
            for (t2 = 0; t2 < l; t2++) e2.dyn_ltree[2 * t2] = 0;
            for (t2 = 0; t2 < f; t2++) e2.dyn_dtree[2 * t2] = 0;
            for (t2 = 0; t2 < c; t2++) e2.bl_tree[2 * t2] = 0;
            e2.dyn_ltree[2 * m] = 1, e2.opt_len = e2.static_len = 0, e2.last_lit = e2.matches = 0;
          }
          function M(e2) {
            8 < e2.bi_valid ? U(e2, e2.bi_buf) : 0 < e2.bi_valid && (e2.pending_buf[e2.pending++] = e2.bi_buf), e2.bi_buf = 0, e2.bi_valid = 0;
          }
          function H(e2, t2, r2, n2) {
            var i2 = 2 * t2, s2 = 2 * r2;
            return e2[i2] < e2[s2] || e2[i2] === e2[s2] && n2[t2] <= n2[r2];
          }
          function G(e2, t2, r2) {
            for (var n2 = e2.heap[r2], i2 = r2 << 1; i2 <= e2.heap_len && (i2 < e2.heap_len && H(t2, e2.heap[i2 + 1], e2.heap[i2], e2.depth) && i2++, !H(t2, n2, e2.heap[i2], e2.depth)); ) e2.heap[r2] = e2.heap[i2], r2 = i2, i2 <<= 1;
            e2.heap[r2] = n2;
          }
          function K(e2, t2, r2) {
            var n2, i2, s2, a2, o2 = 0;
            if (0 !== e2.last_lit) for (; n2 = e2.pending_buf[e2.d_buf + 2 * o2] << 8 | e2.pending_buf[e2.d_buf + 2 * o2 + 1], i2 = e2.pending_buf[e2.l_buf + o2], o2++, 0 === n2 ? L(e2, i2, t2) : (L(e2, (s2 = A[i2]) + u + 1, t2), 0 !== (a2 = w[s2]) && P(e2, i2 -= I[s2], a2), L(e2, s2 = N(--n2), r2), 0 !== (a2 = k[s2]) && P(e2, n2 -= T[s2], a2)), o2 < e2.last_lit; ) ;
            L(e2, m, t2);
          }
          function Y(e2, t2) {
            var r2, n2, i2, s2 = t2.dyn_tree, a2 = t2.stat_desc.static_tree, o2 = t2.stat_desc.has_stree, h2 = t2.stat_desc.elems, u2 = -1;
            for (e2.heap_len = 0, e2.heap_max = _, r2 = 0; r2 < h2; r2++) 0 !== s2[2 * r2] ? (e2.heap[++e2.heap_len] = u2 = r2, e2.depth[r2] = 0) : s2[2 * r2 + 1] = 0;
            for (; e2.heap_len < 2; ) s2[2 * (i2 = e2.heap[++e2.heap_len] = u2 < 2 ? ++u2 : 0)] = 1, e2.depth[i2] = 0, e2.opt_len--, o2 && (e2.static_len -= a2[2 * i2 + 1]);
            for (t2.max_code = u2, r2 = e2.heap_len >> 1; 1 <= r2; r2--) G(e2, s2, r2);
            for (i2 = h2; r2 = e2.heap[1], e2.heap[1] = e2.heap[e2.heap_len--], G(e2, s2, 1), n2 = e2.heap[1], e2.heap[--e2.heap_max] = r2, e2.heap[--e2.heap_max] = n2, s2[2 * i2] = s2[2 * r2] + s2[2 * n2], e2.depth[i2] = (e2.depth[r2] >= e2.depth[n2] ? e2.depth[r2] : e2.depth[n2]) + 1, s2[2 * r2 + 1] = s2[2 * n2 + 1] = i2, e2.heap[1] = i2++, G(e2, s2, 1), 2 <= e2.heap_len; ) ;
            e2.heap[--e2.heap_max] = e2.heap[1], (function(e3, t3) {
              var r3, n3, i3, s3, a3, o3, h3 = t3.dyn_tree, u3 = t3.max_code, l2 = t3.stat_desc.static_tree, f2 = t3.stat_desc.has_stree, c2 = t3.stat_desc.extra_bits, d2 = t3.stat_desc.extra_base, p2 = t3.stat_desc.max_length, m2 = 0;
              for (s3 = 0; s3 <= g; s3++) e3.bl_count[s3] = 0;
              for (h3[2 * e3.heap[e3.heap_max] + 1] = 0, r3 = e3.heap_max + 1; r3 < _; r3++) p2 < (s3 = h3[2 * h3[2 * (n3 = e3.heap[r3]) + 1] + 1] + 1) && (s3 = p2, m2++), h3[2 * n3 + 1] = s3, u3 < n3 || (e3.bl_count[s3]++, a3 = 0, d2 <= n3 && (a3 = c2[n3 - d2]), o3 = h3[2 * n3], e3.opt_len += o3 * (s3 + a3), f2 && (e3.static_len += o3 * (l2[2 * n3 + 1] + a3)));
              if (0 !== m2) {
                do {
                  for (s3 = p2 - 1; 0 === e3.bl_count[s3]; ) s3--;
                  e3.bl_count[s3]--, e3.bl_count[s3 + 1] += 2, e3.bl_count[p2]--, m2 -= 2;
                } while (0 < m2);
                for (s3 = p2; 0 !== s3; s3--) for (n3 = e3.bl_count[s3]; 0 !== n3; ) u3 < (i3 = e3.heap[--r3]) || (h3[2 * i3 + 1] !== s3 && (e3.opt_len += (s3 - h3[2 * i3 + 1]) * h3[2 * i3], h3[2 * i3 + 1] = s3), n3--);
              }
            })(e2, t2), Z(s2, u2, e2.bl_count);
          }
          function X(e2, t2, r2) {
            var n2, i2, s2 = -1, a2 = t2[1], o2 = 0, h2 = 7, u2 = 4;
            for (0 === a2 && (h2 = 138, u2 = 3), t2[2 * (r2 + 1) + 1] = 65535, n2 = 0; n2 <= r2; n2++) i2 = a2, a2 = t2[2 * (n2 + 1) + 1], ++o2 < h2 && i2 === a2 || (o2 < u2 ? e2.bl_tree[2 * i2] += o2 : 0 !== i2 ? (i2 !== s2 && e2.bl_tree[2 * i2]++, e2.bl_tree[2 * b]++) : o2 <= 10 ? e2.bl_tree[2 * v]++ : e2.bl_tree[2 * y]++, s2 = i2, u2 = (o2 = 0) === a2 ? (h2 = 138, 3) : i2 === a2 ? (h2 = 6, 3) : (h2 = 7, 4));
          }
          function V(e2, t2, r2) {
            var n2, i2, s2 = -1, a2 = t2[1], o2 = 0, h2 = 7, u2 = 4;
            for (0 === a2 && (h2 = 138, u2 = 3), n2 = 0; n2 <= r2; n2++) if (i2 = a2, a2 = t2[2 * (n2 + 1) + 1], !(++o2 < h2 && i2 === a2)) {
              if (o2 < u2) for (; L(e2, i2, e2.bl_tree), 0 != --o2; ) ;
              else 0 !== i2 ? (i2 !== s2 && (L(e2, i2, e2.bl_tree), o2--), L(e2, b, e2.bl_tree), P(e2, o2 - 3, 2)) : o2 <= 10 ? (L(e2, v, e2.bl_tree), P(e2, o2 - 3, 3)) : (L(e2, y, e2.bl_tree), P(e2, o2 - 11, 7));
              s2 = i2, u2 = (o2 = 0) === a2 ? (h2 = 138, 3) : i2 === a2 ? (h2 = 6, 3) : (h2 = 7, 4);
            }
          }
          n(T);
          var q = false;
          function J(e2, t2, r2, n2) {
            P(e2, (s << 1) + (n2 ? 1 : 0), 3), (function(e3, t3, r3, n3) {
              M(e3), n3 && (U(e3, r3), U(e3, ~r3)), i.arraySet(e3.pending_buf, e3.window, t3, r3, e3.pending), e3.pending += r3;
            })(e2, t2, r2, true);
          }
          r._tr_init = function(e2) {
            q || ((function() {
              var e3, t2, r2, n2, i2, s2 = new Array(g + 1);
              for (n2 = r2 = 0; n2 < a - 1; n2++) for (I[n2] = r2, e3 = 0; e3 < 1 << w[n2]; e3++) A[r2++] = n2;
              for (A[r2 - 1] = n2, n2 = i2 = 0; n2 < 16; n2++) for (T[n2] = i2, e3 = 0; e3 < 1 << k[n2]; e3++) E[i2++] = n2;
              for (i2 >>= 7; n2 < f; n2++) for (T[n2] = i2 << 7, e3 = 0; e3 < 1 << k[n2] - 7; e3++) E[256 + i2++] = n2;
              for (t2 = 0; t2 <= g; t2++) s2[t2] = 0;
              for (e3 = 0; e3 <= 143; ) z[2 * e3 + 1] = 8, e3++, s2[8]++;
              for (; e3 <= 255; ) z[2 * e3 + 1] = 9, e3++, s2[9]++;
              for (; e3 <= 279; ) z[2 * e3 + 1] = 7, e3++, s2[7]++;
              for (; e3 <= 287; ) z[2 * e3 + 1] = 8, e3++, s2[8]++;
              for (Z(z, l + 1, s2), e3 = 0; e3 < f; e3++) C[2 * e3 + 1] = 5, C[2 * e3] = j(e3, 5);
              O = new D(z, w, u + 1, l, g), B = new D(C, k, 0, f, g), R = new D(new Array(0), x, 0, c, p);
            })(), q = true), e2.l_desc = new F(e2.dyn_ltree, O), e2.d_desc = new F(e2.dyn_dtree, B), e2.bl_desc = new F(e2.bl_tree, R), e2.bi_buf = 0, e2.bi_valid = 0, W(e2);
          }, r._tr_stored_block = J, r._tr_flush_block = function(e2, t2, r2, n2) {
            var i2, s2, a2 = 0;
            0 < e2.level ? (2 === e2.strm.data_type && (e2.strm.data_type = (function(e3) {
              var t3, r3 = 4093624447;
              for (t3 = 0; t3 <= 31; t3++, r3 >>>= 1) if (1 & r3 && 0 !== e3.dyn_ltree[2 * t3]) return o;
              if (0 !== e3.dyn_ltree[18] || 0 !== e3.dyn_ltree[20] || 0 !== e3.dyn_ltree[26]) return h;
              for (t3 = 32; t3 < u; t3++) if (0 !== e3.dyn_ltree[2 * t3]) return h;
              return o;
            })(e2)), Y(e2, e2.l_desc), Y(e2, e2.d_desc), a2 = (function(e3) {
              var t3;
              for (X(e3, e3.dyn_ltree, e3.l_desc.max_code), X(e3, e3.dyn_dtree, e3.d_desc.max_code), Y(e3, e3.bl_desc), t3 = c - 1; 3 <= t3 && 0 === e3.bl_tree[2 * S[t3] + 1]; t3--) ;
              return e3.opt_len += 3 * (t3 + 1) + 5 + 5 + 4, t3;
            })(e2), i2 = e2.opt_len + 3 + 7 >>> 3, (s2 = e2.static_len + 3 + 7 >>> 3) <= i2 && (i2 = s2)) : i2 = s2 = r2 + 5, r2 + 4 <= i2 && -1 !== t2 ? J(e2, t2, r2, n2) : 4 === e2.strategy || s2 === i2 ? (P(e2, 2 + (n2 ? 1 : 0), 3), K(e2, z, C)) : (P(e2, 4 + (n2 ? 1 : 0), 3), (function(e3, t3, r3, n3) {
              var i3;
              for (P(e3, t3 - 257, 5), P(e3, r3 - 1, 5), P(e3, n3 - 4, 4), i3 = 0; i3 < n3; i3++) P(e3, e3.bl_tree[2 * S[i3] + 1], 3);
              V(e3, e3.dyn_ltree, t3 - 1), V(e3, e3.dyn_dtree, r3 - 1);
            })(e2, e2.l_desc.max_code + 1, e2.d_desc.max_code + 1, a2 + 1), K(e2, e2.dyn_ltree, e2.dyn_dtree)), W(e2), n2 && M(e2);
          }, r._tr_tally = function(e2, t2, r2) {
            return e2.pending_buf[e2.d_buf + 2 * e2.last_lit] = t2 >>> 8 & 255, e2.pending_buf[e2.d_buf + 2 * e2.last_lit + 1] = 255 & t2, e2.pending_buf[e2.l_buf + e2.last_lit] = 255 & r2, e2.last_lit++, 0 === t2 ? e2.dyn_ltree[2 * r2]++ : (e2.matches++, t2--, e2.dyn_ltree[2 * (A[r2] + u + 1)]++, e2.dyn_dtree[2 * N(t2)]++), e2.last_lit === e2.lit_bufsize - 1;
          }, r._tr_align = function(e2) {
            P(e2, 2, 3), L(e2, m, z), (function(e3) {
              16 === e3.bi_valid ? (U(e3, e3.bi_buf), e3.bi_buf = 0, e3.bi_valid = 0) : 8 <= e3.bi_valid && (e3.pending_buf[e3.pending++] = 255 & e3.bi_buf, e3.bi_buf >>= 8, e3.bi_valid -= 8);
            })(e2);
          };
        }, { "../utils/common": 41 }], 53: [function(e, t, r) {
          "use strict";
          t.exports = function() {
            this.input = null, this.next_in = 0, this.avail_in = 0, this.total_in = 0, this.output = null, this.next_out = 0, this.avail_out = 0, this.total_out = 0, this.msg = "", this.state = null, this.data_type = 2, this.adler = 0;
          };
        }, {}], 54: [function(e, t, r) {
          (function(e2) {
            !(function(r2, n) {
              "use strict";
              if (!r2.setImmediate) {
                var i, s, t2, a, o = 1, h = {}, u = false, l = r2.document, e3 = Object.getPrototypeOf && Object.getPrototypeOf(r2);
                e3 = e3 && e3.setTimeout ? e3 : r2, i = "[object process]" === {}.toString.call(r2.process) ? function(e4) {
                  process.nextTick(function() {
                    c(e4);
                  });
                } : (function() {
                  if (r2.postMessage && !r2.importScripts) {
                    var e4 = true, t3 = r2.onmessage;
                    return r2.onmessage = function() {
                      e4 = false;
                    }, r2.postMessage("", "*"), r2.onmessage = t3, e4;
                  }
                })() ? (a = "setImmediate$" + Math.random() + "$", r2.addEventListener ? r2.addEventListener("message", d, false) : r2.attachEvent("onmessage", d), function(e4) {
                  r2.postMessage(a + e4, "*");
                }) : r2.MessageChannel ? ((t2 = new MessageChannel()).port1.onmessage = function(e4) {
                  c(e4.data);
                }, function(e4) {
                  t2.port2.postMessage(e4);
                }) : l && "onreadystatechange" in l.createElement("script") ? (s = l.documentElement, function(e4) {
                  var t3 = l.createElement("script");
                  t3.onreadystatechange = function() {
                    c(e4), t3.onreadystatechange = null, s.removeChild(t3), t3 = null;
                  }, s.appendChild(t3);
                }) : function(e4) {
                  setTimeout(c, 0, e4);
                }, e3.setImmediate = function(e4) {
                  "function" != typeof e4 && (e4 = new Function("" + e4));
                  for (var t3 = new Array(arguments.length - 1), r3 = 0; r3 < t3.length; r3++) t3[r3] = arguments[r3 + 1];
                  var n2 = { callback: e4, args: t3 };
                  return h[o] = n2, i(o), o++;
                }, e3.clearImmediate = f;
              }
              function f(e4) {
                delete h[e4];
              }
              function c(e4) {
                if (u) setTimeout(c, 0, e4);
                else {
                  var t3 = h[e4];
                  if (t3) {
                    u = true;
                    try {
                      !(function(e5) {
                        var t4 = e5.callback, r3 = e5.args;
                        switch (r3.length) {
                          case 0:
                            t4();
                            break;
                          case 1:
                            t4(r3[0]);
                            break;
                          case 2:
                            t4(r3[0], r3[1]);
                            break;
                          case 3:
                            t4(r3[0], r3[1], r3[2]);
                            break;
                          default:
                            t4.apply(n, r3);
                        }
                      })(t3);
                    } finally {
                      f(e4), u = false;
                    }
                  }
                }
              }
              function d(e4) {
                e4.source === r2 && "string" == typeof e4.data && 0 === e4.data.indexOf(a) && c(+e4.data.slice(a.length));
              }
            })("undefined" == typeof self ? void 0 === e2 ? this : e2 : self);
          }).call(this, "undefined" != typeof global ? global : "undefined" != typeof self ? self : "undefined" != typeof window ? window : {});
        }, {}] }, {}, [10])(10);
      });
    }
  });

  // node_modules/fflate/esm/browser.js
  var u8 = Uint8Array;
  var u16 = Uint16Array;
  var i32 = Int32Array;
  var fleb = new u8([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    0,
    /* unused */
    0,
    0,
    /* impossible */
    0
  ]);
  var fdeb = new u8([
    0,
    0,
    0,
    0,
    1,
    1,
    2,
    2,
    3,
    3,
    4,
    4,
    5,
    5,
    6,
    6,
    7,
    7,
    8,
    8,
    9,
    9,
    10,
    10,
    11,
    11,
    12,
    12,
    13,
    13,
    /* unused */
    0,
    0
  ]);
  var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var freb = function(eb, start) {
    var b = new u16(31);
    for (var i = 0; i < 31; ++i) {
      b[i] = start += 1 << eb[i - 1];
    }
    var r = new i32(b[30]);
    for (var i = 1; i < 30; ++i) {
      for (var j = b[i]; j < b[i + 1]; ++j) {
        r[j] = j - b[i] << 5 | i;
      }
    }
    return { b, r };
  };
  var _a = freb(fleb, 2);
  var fl = _a.b;
  var revfl = _a.r;
  fl[28] = 258, revfl[258] = 28;
  var _b = freb(fdeb, 0);
  var fd = _b.b;
  var revfd = _b.r;
  var rev = new u16(32768);
  for (i = 0; i < 32768; ++i) {
    x = (i & 43690) >> 1 | (i & 21845) << 1;
    x = (x & 52428) >> 2 | (x & 13107) << 2;
    x = (x & 61680) >> 4 | (x & 3855) << 4;
    rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
  }
  var x;
  var i;
  var hMap = (function(cd, mb, r) {
    var s = cd.length;
    var i = 0;
    var l = new u16(mb);
    for (; i < s; ++i) {
      if (cd[i])
        ++l[cd[i] - 1];
    }
    var le = new u16(mb);
    for (i = 1; i < mb; ++i) {
      le[i] = le[i - 1] + l[i - 1] << 1;
    }
    var co;
    if (r) {
      co = new u16(1 << mb);
      var rvb = 15 - mb;
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          var sv = i << 4 | cd[i];
          var r_1 = mb - cd[i];
          var v = le[cd[i] - 1]++ << r_1;
          for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
            co[rev[v] >> rvb] = sv;
          }
        }
      }
    } else {
      co = new u16(s);
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
        }
      }
    }
    return co;
  });
  var flt = new u8(288);
  for (i = 0; i < 144; ++i)
    flt[i] = 8;
  var i;
  for (i = 144; i < 256; ++i)
    flt[i] = 9;
  var i;
  for (i = 256; i < 280; ++i)
    flt[i] = 7;
  var i;
  for (i = 280; i < 288; ++i)
    flt[i] = 8;
  var i;
  var fdt = new u8(32);
  for (i = 0; i < 32; ++i)
    fdt[i] = 5;
  var i;
  var flm = /* @__PURE__ */ hMap(flt, 9, 0);
  var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
  var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
  var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
  var max = function(a) {
    var m = a[0];
    for (var i = 1; i < a.length; ++i) {
      if (a[i] > m)
        m = a[i];
    }
    return m;
  };
  var bits = function(d, p, m) {
    var o = p / 8 | 0;
    return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
  };
  var bits16 = function(d, p) {
    var o = p / 8 | 0;
    return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
  };
  var shft = function(p) {
    return (p + 7) / 8 | 0;
  };
  var slc = function(v, s, e) {
    if (s == null || s < 0)
      s = 0;
    if (e == null || e > v.length)
      e = v.length;
    return new u8(v.subarray(s, e));
  };
  var ec = [
    "unexpected EOF",
    "invalid block type",
    "invalid length/literal",
    "invalid distance",
    "stream finished",
    "no stream handler",
    ,
    // determined by compression function
    "no callback",
    "invalid UTF-8 data",
    "extra field too long",
    "date not in range 1980-2099",
    "filename too long",
    "stream finishing",
    "invalid zip data"
    // determined by unknown compression method
  ];
  var err = function(ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
      Error.captureStackTrace(e, err);
    if (!nt)
      throw e;
    return e;
  };
  var inflt = function(dat, st, buf, dict) {
    var sl = dat.length, dl = dict ? dict.length : 0;
    if (!sl || st.f && !st.l)
      return buf || new u8(0);
    var noBuf = !buf;
    var resize = noBuf || st.i != 2;
    var noSt = st.i;
    if (noBuf)
      buf = new u8(sl * 3);
    var cbuf = function(l2) {
      var bl = buf.length;
      if (l2 > bl) {
        var nbuf = new u8(Math.max(bl * 2, l2));
        nbuf.set(buf);
        buf = nbuf;
      }
    };
    var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
    var tbts = sl * 8;
    do {
      if (!lm) {
        final = bits(dat, pos, 1);
        var type = bits(dat, pos + 1, 3);
        pos += 3;
        if (!type) {
          var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
          if (t > sl) {
            if (noSt)
              err(0);
            break;
          }
          if (resize)
            cbuf(bt + l);
          buf.set(dat.subarray(s, t), bt);
          st.b = bt += l, st.p = pos = t * 8, st.f = final;
          continue;
        } else if (type == 1)
          lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
        else if (type == 2) {
          var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
          var tl = hLit + bits(dat, pos + 5, 31) + 1;
          pos += 14;
          var ldt = new u8(tl);
          var clt = new u8(19);
          for (var i = 0; i < hcLen; ++i) {
            clt[clim[i]] = bits(dat, pos + i * 3, 7);
          }
          pos += hcLen * 3;
          var clb = max(clt), clbmsk = (1 << clb) - 1;
          var clm = hMap(clt, clb, 1);
          for (var i = 0; i < tl; ) {
            var r = clm[bits(dat, pos, clbmsk)];
            pos += r & 15;
            var s = r >> 4;
            if (s < 16) {
              ldt[i++] = s;
            } else {
              var c = 0, n = 0;
              if (s == 16)
                n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
              else if (s == 17)
                n = 3 + bits(dat, pos, 7), pos += 3;
              else if (s == 18)
                n = 11 + bits(dat, pos, 127), pos += 7;
              while (n--)
                ldt[i++] = c;
            }
          }
          var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
          lbt = max(lt);
          dbt = max(dt);
          lm = hMap(lt, lbt, 1);
          dm = hMap(dt, dbt, 1);
        } else
          err(1);
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
      }
      if (resize)
        cbuf(bt + 131072);
      var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
      var lpos = pos;
      for (; ; lpos = pos) {
        var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
        pos += c & 15;
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (!c)
          err(2);
        if (sym < 256)
          buf[bt++] = sym;
        else if (sym == 256) {
          lpos = pos, lm = null;
          break;
        } else {
          var add = sym - 254;
          if (sym > 264) {
            var i = sym - 257, b = fleb[i];
            add = bits(dat, pos, (1 << b) - 1) + fl[i];
            pos += b;
          }
          var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
          if (!d)
            err(3);
          pos += d & 15;
          var dt = fd[dsym];
          if (dsym > 3) {
            var b = fdeb[dsym];
            dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
          }
          if (pos > tbts) {
            if (noSt)
              err(0);
            break;
          }
          if (resize)
            cbuf(bt + 131072);
          var end = bt + add;
          if (bt < dt) {
            var shift = dl - dt, dend = Math.min(dt, end);
            if (shift + bt < 0)
              err(3);
            for (; bt < dend; ++bt)
              buf[bt] = dict[shift + bt];
          }
          for (; bt < end; ++bt)
            buf[bt] = buf[bt - dt];
        }
      }
      st.l = lm, st.p = lpos, st.b = bt, st.f = final;
      if (lm)
        final = 1, st.m = lbt, st.d = dm, st.n = dbt;
    } while (!final);
    return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
  };
  var wbits = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
  };
  var wbits16 = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
    d[o + 2] |= v >> 16;
  };
  var hTree = function(d, mb) {
    var t = [];
    for (var i = 0; i < d.length; ++i) {
      if (d[i])
        t.push({ s: i, f: d[i] });
    }
    var s = t.length;
    var t2 = t.slice();
    if (!s)
      return { t: et, l: 0 };
    if (s == 1) {
      var v = new u8(t[0].s + 1);
      v[t[0].s] = 1;
      return { t: v, l: 1 };
    }
    t.sort(function(a, b) {
      return a.f - b.f;
    });
    t.push({ s: -1, f: 25001 });
    var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
    t[0] = { s: -1, f: l.f + r.f, l, r };
    while (i1 != s - 1) {
      l = t[t[i0].f < t[i2].f ? i0++ : i2++];
      r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
      t[i1++] = { s: -1, f: l.f + r.f, l, r };
    }
    var maxSym = t2[0].s;
    for (var i = 1; i < s; ++i) {
      if (t2[i].s > maxSym)
        maxSym = t2[i].s;
    }
    var tr = new u16(maxSym + 1);
    var mbt = ln(t[i1 - 1], tr, 0);
    if (mbt > mb) {
      var i = 0, dt = 0;
      var lft = mbt - mb, cst = 1 << lft;
      t2.sort(function(a, b) {
        return tr[b.s] - tr[a.s] || a.f - b.f;
      });
      for (; i < s; ++i) {
        var i2_1 = t2[i].s;
        if (tr[i2_1] > mb) {
          dt += cst - (1 << mbt - tr[i2_1]);
          tr[i2_1] = mb;
        } else
          break;
      }
      dt >>= lft;
      while (dt > 0) {
        var i2_2 = t2[i].s;
        if (tr[i2_2] < mb)
          dt -= 1 << mb - tr[i2_2]++ - 1;
        else
          ++i;
      }
      for (; i >= 0 && dt; --i) {
        var i2_3 = t2[i].s;
        if (tr[i2_3] == mb) {
          --tr[i2_3];
          ++dt;
        }
      }
      mbt = mb;
    }
    return { t: new u8(tr), l: mbt };
  };
  var ln = function(n, l, d) {
    return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
  };
  var lc = function(c) {
    var s = c.length;
    while (s && !c[--s])
      ;
    var cl = new u16(++s);
    var cli = 0, cln = c[0], cls = 1;
    var w = function(v) {
      cl[cli++] = v;
    };
    for (var i = 1; i <= s; ++i) {
      if (c[i] == cln && i != s)
        ++cls;
      else {
        if (!cln && cls > 2) {
          for (; cls > 138; cls -= 138)
            w(32754);
          if (cls > 2) {
            w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
            cls = 0;
          }
        } else if (cls > 3) {
          w(cln), --cls;
          for (; cls > 6; cls -= 6)
            w(8304);
          if (cls > 2)
            w(cls - 3 << 5 | 8208), cls = 0;
        }
        while (cls--)
          w(cln);
        cls = 1;
        cln = c[i];
      }
    }
    return { c: cl.subarray(0, cli), n: s };
  };
  var clen = function(cf, cl) {
    var l = 0;
    for (var i = 0; i < cl.length; ++i)
      l += cf[i] * cl[i];
    return l;
  };
  var wfblk = function(out, pos, dat) {
    var s = dat.length;
    var o = shft(pos + 2);
    out[o] = s & 255;
    out[o + 1] = s >> 8;
    out[o + 2] = out[o] ^ 255;
    out[o + 3] = out[o + 1] ^ 255;
    for (var i = 0; i < s; ++i)
      out[o + i + 4] = dat[i];
    return (o + 4 + s) * 8;
  };
  var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
    wbits(out, p++, final);
    ++lf[256];
    var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
    var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
    var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
    var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
    var lcfreq = new u16(19);
    for (var i = 0; i < lclt.length; ++i)
      ++lcfreq[lclt[i] & 31];
    for (var i = 0; i < lcdt.length; ++i)
      ++lcfreq[lcdt[i] & 31];
    var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
    var nlcc = 19;
    for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
      ;
    var flen = bl + 5 << 3;
    var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
    var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
    if (bs >= 0 && flen <= ftlen && flen <= dtlen)
      return wfblk(out, p, dat.subarray(bs, bs + bl));
    var lm, ll, dm, dl;
    wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
    if (dtlen < ftlen) {
      lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
      var llm = hMap(lct, mlcb, 0);
      wbits(out, p, nlc - 257);
      wbits(out, p + 5, ndc - 1);
      wbits(out, p + 10, nlcc - 4);
      p += 14;
      for (var i = 0; i < nlcc; ++i)
        wbits(out, p + 3 * i, lct[clim[i]]);
      p += 3 * nlcc;
      var lcts = [lclt, lcdt];
      for (var it = 0; it < 2; ++it) {
        var clct = lcts[it];
        for (var i = 0; i < clct.length; ++i) {
          var len = clct[i] & 31;
          wbits(out, p, llm[len]), p += lct[len];
          if (len > 15)
            wbits(out, p, clct[i] >> 5 & 127), p += clct[i] >> 12;
        }
      }
    } else {
      lm = flm, ll = flt, dm = fdm, dl = fdt;
    }
    for (var i = 0; i < li; ++i) {
      var sym = syms[i];
      if (sym > 255) {
        var len = sym >> 18 & 31;
        wbits16(out, p, lm[len + 257]), p += ll[len + 257];
        if (len > 7)
          wbits(out, p, sym >> 23 & 31), p += fleb[len];
        var dst = sym & 31;
        wbits16(out, p, dm[dst]), p += dl[dst];
        if (dst > 3)
          wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
      } else {
        wbits16(out, p, lm[sym]), p += ll[sym];
      }
    }
    wbits16(out, p, lm[256]);
    return p + ll[256];
  };
  var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
  var et = /* @__PURE__ */ new u8(0);
  var dflt = function(dat, lvl, plvl, pre, post, st) {
    var s = st.z || dat.length;
    var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
    var w = o.subarray(pre, o.length - post);
    var lst = st.l;
    var pos = (st.r || 0) & 7;
    if (lvl) {
      if (pos)
        w[0] = st.r >> 3;
      var opt = deo[lvl - 1];
      var n = opt >> 13, c = opt & 8191;
      var msk_1 = (1 << plvl) - 1;
      var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
      var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
      var hsh = function(i2) {
        return (dat[i2] ^ dat[i2 + 1] << bs1_1 ^ dat[i2 + 2] << bs2_1) & msk_1;
      };
      var syms = new i32(25e3);
      var lf = new u16(288), df = new u16(32);
      var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
      for (; i + 2 < s; ++i) {
        var hv = hsh(i);
        var imod = i & 32767, pimod = head[hv];
        prev[imod] = pimod;
        head[hv] = imod;
        if (wi <= i) {
          var rem = s - i;
          if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
            pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
            li = lc_1 = eb = 0, bs = i;
            for (var j = 0; j < 286; ++j)
              lf[j] = 0;
            for (var j = 0; j < 30; ++j)
              df[j] = 0;
          }
          var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
          if (rem > 2 && hv == hsh(i - dif)) {
            var maxn = Math.min(n, rem) - 1;
            var maxd = Math.min(32767, i);
            var ml = Math.min(258, rem);
            while (dif <= maxd && --ch_1 && imod != pimod) {
              if (dat[i + l] == dat[i + l - dif]) {
                var nl = 0;
                for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                  ;
                if (nl > l) {
                  l = nl, d = dif;
                  if (nl > maxn)
                    break;
                  var mmd = Math.min(dif, nl - 2);
                  var md = 0;
                  for (var j = 0; j < mmd; ++j) {
                    var ti = i - dif + j & 32767;
                    var pti = prev[ti];
                    var cd = ti - pti & 32767;
                    if (cd > md)
                      md = cd, pimod = ti;
                  }
                }
              }
              imod = pimod, pimod = prev[imod];
              dif += imod - pimod & 32767;
            }
          }
          if (d) {
            syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
            var lin = revfl[l] & 31, din = revfd[d] & 31;
            eb += fleb[lin] + fdeb[din];
            ++lf[257 + lin];
            ++df[din];
            wi = i + l;
            ++lc_1;
          } else {
            syms[li++] = dat[i];
            ++lf[dat[i]];
          }
        }
      }
      for (i = Math.max(i, wi); i < s; ++i) {
        syms[li++] = dat[i];
        ++lf[dat[i]];
      }
      pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
      if (!lst) {
        st.r = pos & 7 | w[pos / 8 | 0] << 3;
        pos -= 7;
        st.h = head, st.p = prev, st.i = i, st.w = wi;
      }
    } else {
      for (var i = st.w || 0; i < s + lst; i += 65535) {
        var e = i + 65535;
        if (e >= s) {
          w[pos / 8 | 0] = lst;
          e = s;
        }
        pos = wfblk(w, pos + 1, dat.subarray(i, e));
      }
      st.i = s;
    }
    return slc(o, 0, pre + shft(pos) + post);
  };
  var crct = /* @__PURE__ */ (function() {
    var t = new Int32Array(256);
    for (var i = 0; i < 256; ++i) {
      var c = i, k = 9;
      while (--k)
        c = (c & 1 && -306674912) ^ c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  var crc = function() {
    var c = -1;
    return {
      p: function(d) {
        var cr = c;
        for (var i = 0; i < d.length; ++i)
          cr = crct[cr & 255 ^ d[i]] ^ cr >>> 8;
        c = cr;
      },
      d: function() {
        return ~c;
      }
    };
  };
  var dopt = function(dat, opt, pre, post, st) {
    if (!st) {
      st = { l: 1 };
      if (opt.dictionary) {
        var dict = opt.dictionary.subarray(-32768);
        var newDat = new u8(dict.length + dat.length);
        newDat.set(dict);
        newDat.set(dat, dict.length);
        dat = newDat;
        st.w = dict.length;
      }
    }
    return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
  };
  var wbytes = function(d, b, v) {
    for (; v; ++b)
      d[b] = v, v >>>= 8;
  };
  var gzh = function(c, o) {
    var fn = o.filename;
    c[0] = 31, c[1] = 139, c[2] = 8, c[8] = o.level < 2 ? 4 : o.level == 9 ? 2 : 0, c[9] = 3;
    if (o.mtime != 0)
      wbytes(c, 4, Math.floor(new Date(o.mtime || Date.now()) / 1e3));
    if (fn) {
      c[3] = 8;
      for (var i = 0; i <= fn.length; ++i)
        c[i + 10] = fn.charCodeAt(i);
    }
  };
  var gzs = function(d) {
    if (d[0] != 31 || d[1] != 139 || d[2] != 8)
      err(6, "invalid gzip data");
    var flg = d[3];
    var st = 10;
    if (flg & 4)
      st += (d[10] | d[11] << 8) + 2;
    for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d[st++])
      ;
    return st + (flg & 2);
  };
  var gzl = function(d) {
    var l = d.length;
    return (d[l - 4] | d[l - 3] << 8 | d[l - 2] << 16 | d[l - 1] << 24) >>> 0;
  };
  var gzhl = function(o) {
    return 10 + (o.filename ? o.filename.length + 1 : 0);
  };
  function gzipSync(data, opts) {
    if (!opts)
      opts = {};
    var c = crc(), l = data.length;
    c.p(data);
    var d = dopt(data, opts, gzhl(opts), 8), s = d.length;
    return gzh(d, opts), wbytes(d, s - 8, c.d()), wbytes(d, s - 4, l), d;
  }
  function gunzipSync(data, opts) {
    var st = gzs(data);
    if (st + 8 > data.length)
      err(6, "invalid gzip data");
    return inflt(data.subarray(st, -8), { i: 2 }, opts && opts.out || new u8(gzl(data)), opts && opts.dictionary);
  }
  var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
  var tds = 0;
  try {
    td.decode(et, { stream: true });
    tds = 1;
  } catch (e) {
  }

  // src/shared/swarm-bundle.js
  var MAGIC = [83, 87, 65, 82, 77];
  var VERSION = 2;
  var HEADER_LENGTH = 7;
  var COMPRESSION_NONE = 0;
  var COMPRESSION_GZIP = 1;
  var encoder = new TextEncoder();
  var decoder = new TextDecoder("utf-8", { fatal: true });
  var SwarmBundleError = class extends Error {
    constructor(message, options) {
      super(message, options);
      this.name = "SwarmBundleError";
    }
  };
  function decodeSwarmBundle(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length < HEADER_LENGTH || !hasMagic(bytes)) {
      throw new SwarmBundleError("Invalid SWARM magic bytes or truncated header");
    }
    const version = bytes[5];
    if (version !== VERSION) {
      throw new SwarmBundleError(`Unsupported SWARM bundle version: ${version}`);
    }
    const compression = bytes[6];
    if (compression !== COMPRESSION_NONE && compression !== COMPRESSION_GZIP) {
      throw new SwarmBundleError(`Unsupported SWARM compression byte: ${compression}`);
    }
    let payload = bytes.subarray(HEADER_LENGTH);
    if (compression === COMPRESSION_GZIP) {
      try {
        payload = gunzipSync(payload);
      } catch (error) {
        throw new SwarmBundleError("Invalid gzip payload in SWARM bundle", { cause: error });
      }
    }
    let project;
    try {
      project = JSON.parse(decoder.decode(payload));
    } catch (error) {
      throw new SwarmBundleError("Invalid JSON payload in SWARM bundle", { cause: error });
    }
    if (project === null || typeof project !== "object" || Array.isArray(project)) {
      throw new SwarmBundleError("Invalid JSON payload in SWARM bundle: project must be an object");
    }
    return project;
  }
  function encodeSwarmBundle(projectJson, { compress = true } = {}) {
    let serialized;
    try {
      serialized = JSON.stringify(projectJson);
    } catch (error) {
      throw new SwarmBundleError("Unable to serialize project JSON for SWARM bundle", { cause: error });
    }
    if (serialized === void 0) {
      throw new SwarmBundleError("Unable to serialize project JSON for SWARM bundle");
    }
    const payload = encoder.encode(serialized);
    const compression = compress ? COMPRESSION_GZIP : COMPRESSION_NONE;
    const encodedPayload = compress ? gzipSync(payload) : payload;
    const bundle = new Uint8Array(HEADER_LENGTH + encodedPayload.length);
    for (let index = 0; index < MAGIC.length; index += 1) bundle[index] = MAGIC[index];
    bundle[5] = VERSION;
    bundle[6] = compression;
    bundle.set(encodedPayload, HEADER_LENGTH);
    return bundle;
  }
  function hasMagic(bytes) {
    for (let index = 0; index < MAGIC.length; index += 1) {
      if (bytes[index] !== MAGIC[index]) return false;
    }
    return true;
  }
  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 32768;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }
  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  // src/shared/activity-config.schema.json
  var activity_config_schema_default = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "urn:scorm-swarm:activity-config.schema.json",
    title: "Swarm SCORM activity configuration",
    type: "object",
    additionalProperties: false,
    required: ["metadata", "evaluation"],
    properties: {
      metadata: {
        type: "object",
        additionalProperties: false,
        required: ["activity_id"],
        properties: {
          activity_id: { type: "string", pattern: "^[a-z0-9_-]+$" },
          title: { type: "string", default: "Untitled activity" },
          instructions_markdown: { type: "string", default: "" },
          learning_objectives_markdown: { type: "string", default: "" },
          teacher_notes_markdown: { type: "string", default: "" }
        }
      },
      capabilities: {
        type: "object",
        additionalProperties: false,
        properties: {
          move_devices: { type: "boolean", default: true },
          move_nodes: { type: "boolean", default: true },
          use_buttons: { type: "boolean", default: true },
          load_code: { type: "boolean", default: true },
          edit_code: { type: "boolean", default: true }
        }
      },
      panel_visibility: {
        type: "object",
        additionalProperties: false,
        properties: {
          debug_panel: { type: "boolean", default: false },
          radio_inspector: { type: "boolean", default: true },
          runtime_log: { type: "boolean", default: false },
          environment_values: { type: "boolean", default: true },
          node_coordinates: { type: "boolean", default: false },
          panel_header: { type: "boolean", default: false }
        }
      },
      evaluation: {
        type: "object",
        additionalProperties: false,
        required: ["test_cases"],
        properties: {
          test_cases: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/$defs/testCase" }
          }
        }
      },
      hints: {
        type: "array",
        default: [],
        items: { $ref: "#/$defs/hint" }
      }
    },
    $defs: {
      deviceId: { type: ["string", "null"] },
      minCount: { type: "integer", minimum: 1, default: 1 },
      nullableInteger: { type: ["integer", "null"], default: null },
      nullableNumber: { type: ["number", "null"], default: null },
      payloadMatch: {
        type: "object",
        additionalProperties: false,
        required: ["match", "value"],
        properties: {
          match: { enum: ["contains", "exact", "regex", "hex"] },
          value: { type: "string" },
          case_sensitive: { type: "boolean", default: true }
        }
      },
      condition: {
        oneOf: [
          { $ref: "#/$defs/composite" },
          { $ref: "#/$defs/serialOutput" },
          { $ref: "#/$defs/buttonPress" },
          { $ref: "#/$defs/radioTx" },
          { $ref: "#/$defs/radioRx" },
          { $ref: "#/$defs/sensorReading" },
          { $ref: "#/$defs/ledDisplay" }
        ]
      },
      checkCondition: {
        oneOf: [
          { $ref: "#/$defs/checkComposite" },
          { $ref: "#/$defs/serialOutput" },
          { $ref: "#/$defs/buttonPress" },
          { $ref: "#/$defs/radioTx" },
          { $ref: "#/$defs/radioRx" },
          { $ref: "#/$defs/sensorReading" },
          { $ref: "#/$defs/ledDisplay" },
          { $ref: "#/$defs/nodeDistance" }
        ]
      },
      checkComposite: {
        type: "object",
        additionalProperties: false,
        required: ["type", "conditions"],
        properties: {
          type: { enum: ["all", "any", "none"] },
          conditions: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/$defs/checkCondition" }
          }
        }
      },
      composite: {
        type: "object",
        additionalProperties: false,
        required: ["type", "conditions"],
        properties: {
          type: { enum: ["all", "any", "none"] },
          conditions: {
            type: "array",
            minItems: 1,
            items: { $ref: "#/$defs/condition" }
          }
        }
      },
      serialOutput: {
        type: "object",
        additionalProperties: false,
        required: ["type", "device_id", "match", "value"],
        properties: {
          type: { const: "serial_output" },
          device_id: { $ref: "#/$defs/deviceId" },
          match: { enum: ["contains", "exact", "regex"] },
          value: { type: "string" },
          case_sensitive: { type: "boolean", default: true },
          min_count: { $ref: "#/$defs/minCount" }
        }
      },
      buttonPress: {
        type: "object",
        additionalProperties: false,
        required: ["type", "device_id"],
        properties: {
          type: { const: "button_press" },
          device_id: { $ref: "#/$defs/deviceId" },
          button: { enum: ["A", "B", "AB", "any"], default: "any" },
          min_count: { $ref: "#/$defs/minCount" }
        }
      },
      radioTx: {
        type: "object",
        additionalProperties: false,
        required: ["type", "device_id"],
        properties: {
          type: { const: "radio_tx" },
          device_id: { $ref: "#/$defs/deviceId" },
          channel: { $ref: "#/$defs/nullableInteger" },
          group: { $ref: "#/$defs/nullableInteger" },
          payload: {
            anyOf: [
              { $ref: "#/$defs/payloadMatch" },
              { type: "null" }
            ],
            default: null
          },
          min_count: { $ref: "#/$defs/minCount" }
        }
      },
      radioRx: {
        type: "object",
        additionalProperties: false,
        required: ["type", "device_id"],
        properties: {
          type: { const: "radio_rx" },
          device_id: { $ref: "#/$defs/deviceId" },
          from_device_id: { type: ["string", "null"], default: null },
          channel: { $ref: "#/$defs/nullableInteger" },
          group: { $ref: "#/$defs/nullableInteger" },
          payload: {
            anyOf: [
              { $ref: "#/$defs/payloadMatch" },
              { type: "null" }
            ],
            default: null
          },
          rssi_min: { $ref: "#/$defs/nullableNumber" },
          rssi_max: { $ref: "#/$defs/nullableNumber" },
          min_count: { $ref: "#/$defs/minCount" }
        }
      },
      sensorReading: {
        type: "object",
        additionalProperties: false,
        required: ["type", "device_id", "sensor"],
        properties: {
          type: { const: "sensor_reading" },
          device_id: { $ref: "#/$defs/deviceId" },
          sensor: {
            enum: [
              "lightLevel",
              "soundLevel",
              "temperatureC",
              "magneticForceX",
              "magneticForceY",
              "magneticForceZ"
            ]
          },
          min: { $ref: "#/$defs/nullableNumber" },
          max: { $ref: "#/$defs/nullableNumber" },
          min_duration_seconds: { type: "number", minimum: 0, default: 0 }
        }
      },
      ledDisplay: {
        type: "object",
        additionalProperties: false,
        required: ["type", "layout"],
        properties: {
          type: { const: "led_display" },
          device_id: { $ref: "#/$defs/deviceId" },
          layout: { type: "string", pattern: "^[#.0-9]{5}(\\n[#.0-9]{5}){4}$" }
        }
      },
      nodeRef: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "id"],
        properties: {
          kind: { enum: ["device", "source"] },
          id: { type: "string", minLength: 1 }
        }
      },
      nodeDistance: {
        type: "object",
        additionalProperties: false,
        required: ["type", "node_a", "node_b"],
        properties: {
          type: { const: "node_distance" },
          node_a: { $ref: "#/$defs/nodeRef" },
          node_b: { $ref: "#/$defs/nodeRef" },
          min: { $ref: "#/$defs/nullableNumber" },
          max: { $ref: "#/$defs/nullableNumber" }
        }
      },
      actionTarget: { type: ["string", "null"] },
      testAction: {
        oneOf: [
          { $ref: "#/$defs/actionRadioBroadcast" },
          { $ref: "#/$defs/actionPressButton" },
          { $ref: "#/$defs/actionSetNodeLevel" },
          { $ref: "#/$defs/actionAddNode" },
          { $ref: "#/$defs/actionMoveNode" }
        ]
      },
      actionRadioBroadcast: {
        type: "object",
        additionalProperties: false,
        required: ["type", "device_id"],
        properties: {
          type: { const: "radio_broadcast" },
          device_id: { $ref: "#/$defs/actionTarget" },
          channel: { $ref: "#/$defs/nullableInteger" },
          group: { $ref: "#/$defs/nullableInteger" },
          payload: { type: "string", default: "" },
          count: { type: "integer", minimum: 1, default: 1 },
          interval_ms: { type: "integer", minimum: 0, default: 0 }
        }
      },
      actionPressButton: {
        type: "object",
        additionalProperties: false,
        required: ["type", "device_id"],
        properties: {
          type: { const: "press_button" },
          device_id: { $ref: "#/$defs/actionTarget" },
          button: { enum: ["A", "B", "AB"], default: "A" },
          count: { type: "integer", minimum: 1, default: 1 },
          interval_ms: { type: "integer", minimum: 0, default: 0 }
        }
      },
      actionSetNodeLevel: {
        type: "object",
        additionalProperties: false,
        required: ["type", "node_id", "value"],
        properties: {
          type: { const: "set_node_level" },
          node_id: { $ref: "#/$defs/actionTarget" },
          value: { type: "number" }
        }
      },
      actionAddNode: {
        type: "object",
        additionalProperties: false,
        required: ["type", "node_type", "x", "y"],
        properties: {
          type: { const: "add_node" },
          node_type: { enum: ["light", "sound", "temperature", "magnet"] },
          x: { type: "number" },
          y: { type: "number" },
          level: { $ref: "#/$defs/nullableNumber" },
          duration_seconds: { type: "number", minimum: 0, default: 10 }
        }
      },
      actionMoveNode: {
        type: "object",
        additionalProperties: false,
        required: ["type", "node_id", "x", "y"],
        properties: {
          type: { const: "move_node" },
          node_id: { $ref: "#/$defs/actionTarget" },
          x: { type: "number", minimum: 0, maximum: 860 },
          y: { type: "number", minimum: 0, maximum: 520 }
        }
      },
      testStep: {
        oneOf: [
          { $ref: "#/$defs/stepAction" },
          { $ref: "#/$defs/stepCheck" }
        ]
      },
      stepAction: {
        type: "object",
        additionalProperties: false,
        required: ["type", "action"],
        properties: {
          type: { const: "action" },
          action: { $ref: "#/$defs/testAction" }
        }
      },
      stepCheck: {
        type: "object",
        additionalProperties: false,
        required: ["type", "condition"],
        properties: {
          type: { const: "check" },
          condition: { $ref: "#/$defs/checkCondition" },
          timeout_ms: { type: "number", minimum: 0, default: 5e3 }
        }
      },
      testCase: {
        type: "object",
        additionalProperties: false,
        required: ["id", "trigger", "steps"],
        properties: {
          id: { type: "string" },
          points: { type: "integer", minimum: 0, default: 1 },
          feedback_on_pass: { type: "string" },
          feedback_on_fail: { type: "string" },
          trigger: { type: "array", items: { $ref: "#/$defs/testAction" } },
          steps: { type: "array", minItems: 1, items: { $ref: "#/$defs/testStep" } }
        }
      },
      hint: {
        type: "object",
        additionalProperties: false,
        required: ["id", "trigger", "message"],
        properties: {
          id: { type: "string" },
          trigger: { $ref: "#/$defs/hintTrigger" },
          message: { type: "string" },
          priority: { type: "integer", minimum: 1, default: 1 },
          delay_seconds: { type: "number", minimum: 0, default: 0 },
          show_once: { type: "boolean", default: false },
          display_mode: { enum: ["triggered", "checklist"], default: "triggered" },
          style: { enum: ["info", "success", "warning"], default: "info" }
        }
      },
      hintTrigger: {
        type: "object",
        additionalProperties: false,
        required: ["event", "conditions"],
        properties: {
          event: { enum: ["sim_event", "test_fail", "manual"] },
          conditions: { $ref: "#/$defs/condition" },
          after_attempts: { type: "integer", minimum: 0, default: 0 },
          invalidate_on_condition_false: { type: "boolean", default: false }
        }
      }
    }
  };

  // src/shared/config-validator.js
  var CONDITION_SCHEMAS = {
    all: activity_config_schema_default.$defs.composite,
    any: activity_config_schema_default.$defs.composite,
    none: activity_config_schema_default.$defs.composite,
    serial_output: activity_config_schema_default.$defs.serialOutput,
    button_press: activity_config_schema_default.$defs.buttonPress,
    radio_tx: activity_config_schema_default.$defs.radioTx,
    radio_rx: activity_config_schema_default.$defs.radioRx,
    sensor_reading: activity_config_schema_default.$defs.sensorReading,
    led_display: activity_config_schema_default.$defs.ledDisplay,
    node_distance: activity_config_schema_default.$defs.nodeDistance
  };
  var CHECK_ONLY_CONDITION_TYPES = ["node_distance"];
  var ACTION_SCHEMAS = {
    radio_broadcast: activity_config_schema_default.$defs.actionRadioBroadcast,
    press_button: activity_config_schema_default.$defs.actionPressButton,
    set_node_level: activity_config_schema_default.$defs.actionSetNodeLevel,
    add_node: activity_config_schema_default.$defs.actionAddNode,
    move_node: activity_config_schema_default.$defs.actionMoveNode
  };
  var ALLOWED_FIELDS = {
    root: activity_config_schema_default.properties,
    metadata: activity_config_schema_default.properties.metadata.properties,
    capabilities: activity_config_schema_default.properties.capabilities.properties,
    panel_visibility: activity_config_schema_default.properties.panel_visibility.properties,
    evaluation: activity_config_schema_default.properties.evaluation.properties,
    testCase: activity_config_schema_default.$defs.testCase.properties,
    testStep: {
      action: activity_config_schema_default.$defs.stepAction.properties,
      check: activity_config_schema_default.$defs.stepCheck.properties
    },
    hint: activity_config_schema_default.$defs.hint.properties,
    hintTrigger: activity_config_schema_default.$defs.hintTrigger.properties,
    condition: Object.fromEntries(
      Object.entries(CONDITION_SCHEMAS).map(([type, conditionSchema]) => [
        type,
        conditionSchema.properties
      ])
    ),
    action: Object.fromEntries(
      Object.entries(ACTION_SCHEMAS).map(([type, actionSchema]) => [
        type,
        actionSchema.properties
      ])
    ),
    payload: activity_config_schema_default.$defs.payloadMatch.properties,
    nodeRef: activity_config_schema_default.$defs.nodeRef.properties
  };
  var VALID_CONDITION_TYPES = Object.keys(CONDITION_SCHEMAS);
  var VALID_CHECK_ONLY_CONDITION_TYPES = CHECK_ONLY_CONDITION_TYPES;
  var VALID_ACTION_TYPES = Object.keys(ACTION_SCHEMAS);
  var VALID_NODE_TYPES = activity_config_schema_default.$defs.actionAddNode.properties.node_type.enum;
  var VALID_ACTION_BUTTONS = activity_config_schema_default.$defs.actionPressButton.properties.button.enum;
  var VALID_LAYOUT_PATTERN = activity_config_schema_default.$defs.ledDisplay.properties.layout.pattern;
  var VALID_HINT_EVENTS = activity_config_schema_default.$defs.hintTrigger.properties.event.enum;
  var VALID_HINT_DISPLAY_MODES = activity_config_schema_default.$defs.hint.properties.display_mode.enum;
  var VALID_HINT_STYLES = activity_config_schema_default.$defs.hint.properties.style.enum;
  var VALID_SENSOR_TYPES = activity_config_schema_default.$defs.sensorReading.properties.sensor.enum;
  var STRING_MATCHES = activity_config_schema_default.$defs.serialOutput.properties.match.enum;
  var PAYLOAD_MATCHES = activity_config_schema_default.$defs.payloadMatch.properties.match.enum;
  var BUTTONS = activity_config_schema_default.$defs.buttonPress.properties.button.enum;
  var CANVAS_WIDTH = 860;
  var CANVAS_HEIGHT = 520;
  function validateConfig(config) {
    const errors = [];
    if (!isObject(config)) {
      return result([{ path: "", message: "must be an object" }]);
    }
    rejectUnknown(config, ALLOWED_FIELDS.root, "", errors);
    if (!isObject(config.metadata)) {
      errors.push({ path: "metadata", message: "is required and must be an object" });
    } else {
      validateMetadata(config.metadata, errors);
    }
    if (config.capabilities !== void 0) {
      if (!isObject(config.capabilities)) {
        errors.push({ path: "capabilities", message: "must be an object" });
      } else {
        rejectUnknown(config.capabilities, ALLOWED_FIELDS.capabilities, "capabilities", errors);
        for (const field of Object.keys(ALLOWED_FIELDS.capabilities)) {
          if (config.capabilities[field] !== void 0 && typeof config.capabilities[field] !== "boolean") {
            errors.push({ path: `capabilities.${field}`, message: "must be a boolean" });
          }
        }
      }
    }
    if (config.panel_visibility !== void 0) {
      if (!isObject(config.panel_visibility)) {
        errors.push({ path: "panel_visibility", message: "must be an object" });
      } else {
        rejectUnknown(config.panel_visibility, ALLOWED_FIELDS.panel_visibility, "panel_visibility", errors);
        for (const field of Object.keys(ALLOWED_FIELDS.panel_visibility)) {
          if (config.panel_visibility[field] !== void 0 && typeof config.panel_visibility[field] !== "boolean") {
            errors.push({ path: `panel_visibility.${field}`, message: "must be a boolean" });
          }
        }
      }
    }
    if (!isObject(config.evaluation)) {
      errors.push({ path: "evaluation", message: "is required and must be an object" });
    } else {
      validateEvaluation(config.evaluation, errors);
    }
    if (config.hints !== void 0 && !Array.isArray(config.hints)) {
      errors.push({ path: "hints", message: "must be an array" });
    }
    const testCases = isObject(config.evaluation) && Array.isArray(config.evaluation.test_cases) ? config.evaluation.test_cases : [];
    const hints = Array.isArray(config.hints) ? config.hints : [];
    const ids = /* @__PURE__ */ new Set();
    testCases.forEach((testCase, index) => {
      validateTestCaseInto(testCase, `evaluation.test_cases[${index}]`, errors);
      recordUniqueId(testCase, `evaluation.test_cases[${index}].id`, ids, errors);
    });
    hints.forEach((hint, index) => {
      validateHintInto(hint, `hints[${index}]`, errors);
      recordUniqueId(hint, `hints[${index}].id`, ids, errors);
    });
    return result(errors);
  }
  function validateMetadata(metadata, errors) {
    rejectUnknown(metadata, ALLOWED_FIELDS.metadata, "metadata", errors);
    if (typeof metadata.activity_id !== "string") {
      errors.push({ path: "metadata.activity_id", message: "is required and must be a string" });
    } else if (!/^[a-z0-9_-]+$/.test(metadata.activity_id)) {
      errors.push({ path: "metadata.activity_id", message: "must match ^[a-z0-9_-]+$" });
    }
    for (const field of [
      "title",
      "instructions_markdown",
      "learning_objectives_markdown",
      "teacher_notes_markdown"
    ]) {
      if (metadata[field] !== void 0 && typeof metadata[field] !== "string") {
        errors.push({ path: `metadata.${field}`, message: "must be a string" });
      }
    }
  }
  function validateEvaluation(evaluation, errors) {
    rejectUnknown(evaluation, ALLOWED_FIELDS.evaluation, "evaluation", errors);
    if (!Array.isArray(evaluation.test_cases)) {
      errors.push({ path: "evaluation.test_cases", message: "is required and must be an array" });
    } else if (evaluation.test_cases.length < 1) {
      errors.push({ path: "evaluation.test_cases", message: "must contain at least one test case" });
    }
  }
  function validateTestCaseInto(testCase, path, errors) {
    if (!isObject(testCase)) {
      errors.push({ path, message: "must be an object" });
      return;
    }
    rejectUnknown(testCase, ALLOWED_FIELDS.testCase, path, errors);
    requireString(testCase, "id", path, errors);
    if (testCase.points !== void 0 && (!Number.isInteger(testCase.points) || testCase.points < 0)) {
      errors.push({ path: `${path}.points`, message: "must be an integer greater than or equal to 0" });
    }
    for (const field of ["feedback_on_pass", "feedback_on_fail"]) {
      if (testCase[field] !== void 0 && typeof testCase[field] !== "string") {
        errors.push({ path: `${path}.${field}`, message: "must be a string" });
      }
    }
    if (!Array.isArray(testCase.trigger)) {
      errors.push({ path: `${path}.trigger`, message: "is required and must be an array" });
    } else {
      testCase.trigger.forEach(
        (action, index) => validateActionInto(action, `${path}.trigger[${index}]`, errors)
      );
    }
    if (!Array.isArray(testCase.steps)) {
      errors.push({ path: `${path}.steps`, message: "is required and must be an array" });
    } else if (testCase.steps.length < 1) {
      errors.push({ path: `${path}.steps`, message: "must contain at least one step" });
    } else {
      testCase.steps.forEach(
        (step, index) => validateStepInto(step, `${path}.steps[${index}]`, errors)
      );
    }
  }
  function validateActionInto(action, path, errors) {
    if (!isObject(action)) {
      errors.push({ path, message: "must be an object" });
      return;
    }
    const type = action.type;
    if (!VALID_ACTION_TYPES.includes(type)) {
      errors.push({ path: `${path}.type`, message: `unknown action type: ${String(type)}` });
      return;
    }
    rejectUnknown(action, ALLOWED_FIELDS.action[type], path, errors);
    if (type === "radio_broadcast" || type === "press_button") {
      validateActionTarget(action.device_id, `${path}.device_id`, "device", errors);
    }
    if (type === "radio_broadcast") {
      validateNullableInteger(action.channel, `${path}.channel`, errors);
      validateNullableInteger(action.group, `${path}.group`, errors);
      if (action.payload !== void 0 && typeof action.payload !== "string") {
        errors.push({ path: `${path}.payload`, message: "must be a string" });
      }
    }
    if (type === "press_button") {
      if (action.button !== void 0 && !VALID_ACTION_BUTTONS.includes(action.button)) {
        errors.push({ path: `${path}.button`, message: 'must be "A", "B", or "AB"' });
      }
    }
    if (type === "radio_broadcast" || type === "press_button") {
      validateMinCount(action.count, `${path}.count`, errors);
      if (action.interval_ms !== void 0 && (!Number.isInteger(action.interval_ms) || action.interval_ms < 0)) {
        errors.push({ path: `${path}.interval_ms`, message: "must be an integer greater than or equal to 0" });
      }
    }
    if (type === "set_node_level") {
      validateActionTarget(action.node_id, `${path}.node_id`, "node", errors);
      if (action.value === void 0 || !isFiniteNumber(action.value)) {
        errors.push({ path: `${path}.value`, message: "is required and must be a finite number" });
      }
    }
    if (type === "move_node") {
      validateActionTarget(action.node_id, `${path}.node_id`, "node", errors);
      for (const [field, maximum] of [["x", CANVAS_WIDTH], ["y", CANVAS_HEIGHT]]) {
        const value = action[field];
        if (!isFiniteNumber(value)) {
          errors.push({ path: `${path}.${field}`, message: "is required and must be a finite number" });
        } else if (value < 0 || value > maximum) {
          errors.push({ path: `${path}.${field}`, message: `must be between 0 and ${maximum}` });
        }
      }
    }
    if (type === "add_node") {
      if (!VALID_NODE_TYPES.includes(action.node_type)) {
        errors.push({ path: `${path}.node_type`, message: 'must be "light", "sound", "temperature", or "magnet"' });
      }
      for (const field of ["x", "y"]) {
        if (action[field] === void 0 || !isFiniteNumber(action[field])) {
          errors.push({ path: `${path}.${field}`, message: "is required and must be a finite number" });
        }
      }
      validateNullableNumber(action.level, `${path}.level`, errors);
      if (action.duration_seconds !== void 0 && !isNonNegativeNumber(action.duration_seconds)) {
        errors.push({ path: `${path}.duration_seconds`, message: "must be a non-negative number" });
      }
    }
  }
  function validateStepInto(step, path, errors) {
    if (!isObject(step)) {
      errors.push({ path, message: "must be an object" });
      return;
    }
    const type = step.type;
    if (type !== "action" && type !== "check") {
      errors.push({ path: `${path}.type`, message: 'must be "action" or "check"' });
      return;
    }
    rejectUnknown(step, ALLOWED_FIELDS.testStep[type], path, errors);
    if (type === "action") {
      if (step.action === void 0) {
        errors.push({ path: `${path}.action`, message: "is required" });
      } else {
        validateActionInto(step.action, `${path}.action`, errors);
      }
      return;
    }
    if (step.condition === void 0) {
      errors.push({ path: `${path}.condition`, message: "is required" });
    } else {
      validateConditionInto(step.condition, `${path}.condition`, errors, true);
    }
    if (step.timeout_ms !== void 0 && !isNonNegativeNumber(step.timeout_ms)) {
      errors.push({ path: `${path}.timeout_ms`, message: "must be a non-negative number" });
    }
  }
  function validateActionTarget(value, path, kind, errors) {
    if (value === void 0 || value === null || typeof value === "string" && value.trim() === "") {
      errors.push({
        path,
        message: kind === "device" ? "must reference a scene device" : "must reference a scene node"
      });
      return;
    }
    if (typeof value !== "string") {
      errors.push({ path, message: "must be a string" });
    }
  }
  function validateHintInto(hint, path, errors) {
    if (!isObject(hint)) {
      errors.push({ path, message: "must be an object" });
      return;
    }
    rejectUnknown(hint, ALLOWED_FIELDS.hint, path, errors);
    requireString(hint, "id", path, errors);
    requireString(hint, "message", path, errors);
    if (hint.priority !== void 0 && (!Number.isInteger(hint.priority) || hint.priority < 1)) {
      errors.push({ path: `${path}.priority`, message: "must be an integer greater than or equal to 1" });
    }
    if (hint.delay_seconds !== void 0 && !isNonNegativeNumber(hint.delay_seconds)) {
      errors.push({ path: `${path}.delay_seconds`, message: "must be a non-negative number" });
    }
    if (hint.show_once !== void 0 && typeof hint.show_once !== "boolean") {
      errors.push({ path: `${path}.show_once`, message: "must be a boolean" });
    }
    if (hint.display_mode !== void 0 && !VALID_HINT_DISPLAY_MODES.includes(hint.display_mode)) {
      errors.push({ path: `${path}.display_mode`, message: 'must be "triggered" or "checklist"' });
    }
    if (hint.style !== void 0 && !VALID_HINT_STYLES.includes(hint.style)) {
      errors.push({ path: `${path}.style`, message: 'must be "info", "success", or "warning"' });
    }
    const triggerPath = `${path}.trigger`;
    if (!isObject(hint.trigger)) {
      errors.push({ path: triggerPath, message: "is required and must be an object" });
      return;
    }
    const trigger = hint.trigger;
    rejectUnknown(trigger, ALLOWED_FIELDS.hintTrigger, triggerPath, errors);
    if (!VALID_HINT_EVENTS.includes(trigger.event)) {
      errors.push({ path: `${triggerPath}.event`, message: 'must be "sim_event", "test_fail", or "manual"' });
    }
    if (trigger.after_attempts !== void 0 && (!Number.isInteger(trigger.after_attempts) || trigger.after_attempts < 0)) {
      errors.push({ path: `${triggerPath}.after_attempts`, message: "must be a non-negative integer" });
    }
    if (trigger.invalidate_on_condition_false !== void 0 && typeof trigger.invalidate_on_condition_false !== "boolean") {
      errors.push({ path: `${triggerPath}.invalidate_on_condition_false`, message: "must be a boolean" });
    }
    if (trigger.conditions === void 0) {
      errors.push({ path: `${triggerPath}.conditions`, message: "is required" });
    } else {
      validateConditionInto(trigger.conditions, `${triggerPath}.conditions`, errors);
    }
  }
  function validateConditionInto(condition, path, errors, allowNodeDistance = false) {
    if (!isObject(condition)) {
      errors.push({ path, message: "must be an object" });
      return;
    }
    const type = condition.type;
    if (!VALID_CONDITION_TYPES.includes(type)) {
      errors.push({ path: `${path}.type`, message: `unknown condition type: ${String(type)}` });
      return;
    }
    if (!allowNodeDistance && CHECK_ONLY_CONDITION_TYPES.includes(type)) {
      errors.push({
        path: `${path}.type`,
        message: `${type} can only be used in a test check step`
      });
      return;
    }
    rejectUnknown(condition, ALLOWED_FIELDS.condition[type], path, errors);
    if (type === "all" || type === "any" || type === "none") {
      if (!Array.isArray(condition.conditions)) {
        errors.push({ path: `${path}.conditions`, message: "must be an array" });
        return;
      }
      if (condition.conditions.length < 1) {
        errors.push({ path: `${path}.conditions`, message: "must contain at least one child condition" });
      }
      condition.conditions.forEach(
        (child, index) => validateConditionInto(child, `${path}.conditions[${index}]`, errors, allowNodeDistance)
      );
      return;
    }
    if (type === "node_distance") {
      validateNodeDistance(condition, path, errors);
      return;
    }
    validateDeviceId(condition.device_id, `${path}.device_id`, errors);
    if (type === "serial_output") {
      if (!STRING_MATCHES.includes(condition.match)) {
        errors.push({ path: `${path}.match`, message: 'must be "contains", "exact", or "regex"' });
      }
      requireString(condition, "value", path, errors);
      validateCaseSensitive(condition.case_sensitive, `${path}.case_sensitive`, errors);
      validateMinCount(condition.min_count, `${path}.min_count`, errors);
      if (condition.match === "regex" && typeof condition.value === "string") {
        validateRegex(condition.value, `${path}.value`, errors);
      }
      return;
    }
    if (type === "button_press") {
      if (condition.button !== void 0 && !BUTTONS.includes(condition.button)) {
        errors.push({ path: `${path}.button`, message: 'must be "A", "B", "AB", or "any"' });
      }
      validateMinCount(condition.min_count, `${path}.min_count`, errors);
      return;
    }
    if (type === "radio_tx" || type === "radio_rx") {
      validateNullableInteger(condition.channel, `${path}.channel`, errors);
      validateNullableInteger(condition.group, `${path}.group`, errors);
      validatePayload(condition.payload, `${path}.payload`, errors);
      validateMinCount(condition.min_count, `${path}.min_count`, errors);
      if (type === "radio_rx") {
        if (condition.from_device_id !== void 0 && condition.from_device_id !== null && typeof condition.from_device_id !== "string") {
          errors.push({ path: `${path}.from_device_id`, message: "must be a string or null" });
        }
        validateNullableNumber(condition.rssi_min, `${path}.rssi_min`, errors);
        validateNullableNumber(condition.rssi_max, `${path}.rssi_max`, errors);
        if (isFiniteNumber(condition.rssi_min) && isFiniteNumber(condition.rssi_max) && condition.rssi_min > condition.rssi_max) {
          errors.push({ path, message: "rssi_min must be less than or equal to rssi_max" });
        }
      }
      return;
    }
    if (type === "led_display") {
      if (typeof condition.layout !== "string" || !new RegExp(VALID_LAYOUT_PATTERN).test(condition.layout)) {
        errors.push({ path: `${path}.layout`, message: "must be five rows of five characters (#/1\u20139 lit, ./0 unlit) separated by newlines" });
      }
      return;
    }
    if (!VALID_SENSOR_TYPES.includes(condition.sensor)) {
      errors.push({ path: `${path}.sensor`, message: "must name a supported sensor" });
    }
    validateNullableNumber(condition.min, `${path}.min`, errors);
    validateNullableNumber(condition.max, `${path}.max`, errors);
    if (isFiniteNumber(condition.min) && isFiniteNumber(condition.max) && condition.min > condition.max) {
      errors.push({ path, message: "min must be less than or equal to max" });
    }
    if (condition.min_duration_seconds !== void 0 && !isNonNegativeNumber(condition.min_duration_seconds)) {
      errors.push({ path: `${path}.min_duration_seconds`, message: "must be a non-negative number" });
    }
  }
  function validateNodeDistance(condition, path, errors) {
    const endpoints = [];
    for (const field of ["node_a", "node_b"]) {
      const ref = condition[field];
      const refPath = `${path}.${field}`;
      if (!isObject(ref)) {
        errors.push({ path: refPath, message: "is required and must be an object" });
        endpoints.push(null);
        continue;
      }
      rejectUnknown(ref, ALLOWED_FIELDS.nodeRef, refPath, errors);
      if (ref.kind !== "device" && ref.kind !== "source") {
        errors.push({ path: `${refPath}.kind`, message: 'must be "device" or "source"' });
      }
      if (typeof ref.id !== "string" || ref.id.trim() === "") {
        errors.push({ path: `${refPath}.id`, message: "must be a non-blank scene object id" });
      }
      endpoints.push(ref);
    }
    if (endpoints[0] && endpoints[1] && endpoints[0].kind === endpoints[1].kind && endpoints[0].id === endpoints[1].id) {
      errors.push({ path, message: "node_a and node_b must be different objects" });
    }
    const hasMin = condition.min !== void 0 && condition.min !== null;
    const hasMax = condition.max !== void 0 && condition.max !== null;
    for (const field of ["min", "max"]) {
      if (condition[field] === void 0 || condition[field] === null) continue;
      if (!isFiniteNumber(condition[field])) {
        errors.push({ path: `${path}.${field}`, message: "must be a finite number or null" });
      } else if (condition[field] < 0) {
        errors.push({ path: `${path}.${field}`, message: "must be greater than or equal to 0" });
      }
    }
    if (!hasMin && !hasMax) {
      errors.push({ path, message: "needs a minimum or maximum distance" });
    }
    if (hasMin && hasMax && isFiniteNumber(condition.min) && isFiniteNumber(condition.max) && condition.min > condition.max) {
      errors.push({ path, message: "min must be less than or equal to max" });
    }
  }
  function validatePayload(payload, path, errors) {
    if (payload === void 0 || payload === null) return;
    if (!isObject(payload)) {
      errors.push({ path, message: "must be an object or null" });
      return;
    }
    rejectUnknown(payload, ALLOWED_FIELDS.payload, path, errors);
    if (!PAYLOAD_MATCHES.includes(payload.match)) {
      errors.push({ path: `${path}.match`, message: 'must be "contains", "exact", "regex", or "hex"' });
    }
    requireString(payload, "value", path, errors);
    validateCaseSensitive(payload.case_sensitive, `${path}.case_sensitive`, errors);
    if (payload.match === "regex" && typeof payload.value === "string") {
      validateRegex(payload.value, `${path}.value`, errors);
    }
    if (payload.match === "hex" && typeof payload.value === "string" && !/^(?:[0-9a-fA-F]{2})*$/.test(payload.value)) {
      errors.push({ path: `${path}.value`, message: "must contain an even number of hexadecimal digits" });
    }
  }
  function validateRegex(value, path, errors) {
    try {
      new RegExp(value);
    } catch (error) {
      errors.push({ path, message: `invalid regular expression: ${error.message}` });
    }
  }
  function validateDeviceId(value, path, errors) {
    if (value !== null && typeof value !== "string") {
      errors.push({ path, message: "must be a string or null" });
    }
  }
  function validateMinCount(value, path, errors) {
    if (value !== void 0 && (!Number.isInteger(value) || value < 1)) {
      errors.push({ path, message: "must be an integer greater than or equal to 1" });
    }
  }
  function validateCaseSensitive(value, path, errors) {
    if (value !== void 0 && typeof value !== "boolean") {
      errors.push({ path, message: "must be a boolean" });
    }
  }
  function validateNullableInteger(value, path, errors) {
    if (value !== void 0 && value !== null && !Number.isInteger(value)) {
      errors.push({ path, message: "must be an integer or null" });
    }
  }
  function validateNullableNumber(value, path, errors) {
    if (value !== void 0 && value !== null && !isFiniteNumber(value)) {
      errors.push({ path, message: "must be a finite number or null" });
    }
  }
  function requireString(object, field, path, errors) {
    if (typeof object[field] !== "string") {
      errors.push({ path: `${path}.${field}`, message: "is required and must be a string" });
    }
  }
  function rejectUnknown(object, allowedFields, path, errors) {
    for (const key of Object.keys(object)) {
      if (!Object.prototype.hasOwnProperty.call(allowedFields, key)) {
        errors.push({ path: path ? `${path}.${key}` : key, message: "is not allowed" });
      }
    }
  }
  function recordUniqueId(value, path, ids, errors) {
    if (!isObject(value) || typeof value.id !== "string") return;
    if (ids.has(value.id)) {
      errors.push({ path, message: `duplicate id: ${value.id}` });
    } else {
      ids.add(value.id);
    }
  }
  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }
  function isNonNegativeNumber(value) {
    return isFiniteNumber(value) && value >= 0;
  }
  function result(errors) {
    return { valid: errors.length === 0, errors };
  }

  // src/shared/config-normalizer.js
  var DEFAULT_METADATA = {
    activity_id: "",
    title: "Untitled activity",
    instructions_markdown: "",
    learning_objectives_markdown: "",
    teacher_notes_markdown: ""
  };
  var DEFAULT_CAPABILITIES = {
    move_devices: true,
    move_nodes: true,
    use_buttons: true,
    load_code: true,
    edit_code: true
  };
  var DEFAULT_PANEL_VISIBILITY = {
    debug_panel: false,
    radio_inspector: true,
    runtime_log: false,
    environment_values: true,
    node_coordinates: false,
    panel_header: false
  };
  var DEFAULT_CHECK_TIMEOUT_MS = 5e3;
  function normalizeConfig(rawConfig) {
    if (!isObject2(rawConfig)) return rawConfig;
    const config = { ...rawConfig };
    config.metadata = rawConfig.metadata === void 0 ? { ...DEFAULT_METADATA } : isObject2(rawConfig.metadata) ? addDefaults(rawConfig.metadata, DEFAULT_METADATA) : rawConfig.metadata;
    config.capabilities = rawConfig.capabilities === void 0 ? { ...DEFAULT_CAPABILITIES } : isObject2(rawConfig.capabilities) ? addDefaults(rawConfig.capabilities, DEFAULT_CAPABILITIES) : rawConfig.capabilities;
    config.panel_visibility = rawConfig.panel_visibility === void 0 ? { ...DEFAULT_PANEL_VISIBILITY } : isObject2(rawConfig.panel_visibility) ? addDefaults(rawConfig.panel_visibility, DEFAULT_PANEL_VISIBILITY) : rawConfig.panel_visibility;
    config.evaluation = normalizeEvaluation(rawConfig.evaluation);
    config.hints = Array.isArray(rawConfig.hints) ? rawConfig.hints.map(normalizeHint) : rawConfig.hints === void 0 ? [] : rawConfig.hints;
    return config;
  }
  function normalizeCondition(condition) {
    if (!isObject2(condition)) return condition;
    const normalized = { ...condition };
    if (Array.isArray(condition.conditions)) {
      normalized.conditions = condition.conditions.map(normalizeCondition);
    }
    switch (condition.type) {
      case "serial_output":
        return addDefaults(normalized, { case_sensitive: true, min_count: 1 });
      case "button_press":
        return addDefaults(normalized, { button: "any", min_count: 1 });
      case "radio_tx":
        if (Object.prototype.hasOwnProperty.call(condition, "payload")) {
          normalized.payload = normalizePayload(condition.payload);
        }
        return addDefaults(normalized, { channel: null, group: null, payload: null, min_count: 1 });
      case "radio_rx":
        if (Object.prototype.hasOwnProperty.call(condition, "payload")) {
          normalized.payload = normalizePayload(condition.payload);
        }
        return addDefaults(normalized, {
          from_device_id: null,
          channel: null,
          group: null,
          payload: null,
          rssi_min: null,
          rssi_max: null,
          min_count: 1
        });
      case "sensor_reading":
        return addDefaults(normalized, { min: null, max: null, min_duration_seconds: 0 });
      case "led_display":
        return addDefaults(normalized, { device_id: null });
      case "node_distance":
        return addDefaults(normalized, { min: null, max: null });
      default:
        return normalized;
    }
  }
  function normalizeEvaluation(evaluation) {
    if (!isObject2(evaluation)) {
      return evaluation === void 0 ? { test_cases: [] } : evaluation;
    }
    const normalized = addDefaults(evaluation, { test_cases: [] });
    if (Array.isArray(evaluation.test_cases)) {
      normalized.test_cases = evaluation.test_cases.map(normalizeTestCase);
    }
    return normalized;
  }
  function normalizeTestCase(testCase) {
    if (!isObject2(testCase)) return testCase;
    const normalized = addDefaults(testCase, { points: 1 });
    if (Array.isArray(testCase.trigger)) {
      normalized.trigger = testCase.trigger.map(normalizeTestAction);
    }
    if (Array.isArray(testCase.steps)) {
      normalized.steps = testCase.steps.map(normalizeTestStep);
    }
    return normalized;
  }
  function normalizeTestAction(action) {
    if (!isObject2(action)) return action;
    switch (action.type) {
      case "radio_broadcast":
        return addDefaults(action, {
          channel: null,
          group: null,
          payload: "",
          count: 1,
          interval_ms: 0
        });
      case "press_button":
        return addDefaults(action, { button: "A", count: 1, interval_ms: 0 });
      case "set_node_level":
        return addDefaults(action, {});
      case "add_node":
        return addDefaults(action, { level: null, duration_seconds: 10 });
      default:
        return action;
    }
  }
  function normalizeTestStep(step) {
    if (!isObject2(step)) return step;
    if (step.type === "action") {
      return isObject2(step.action) ? { ...step, action: normalizeTestAction(step.action) } : step;
    }
    if (step.type === "check") {
      const normalized = normalizeCheckTimeout(step);
      if (isObject2(normalized.condition)) {
        normalized.condition = normalizeCondition(normalized.condition);
      }
      return normalized;
    }
    return step;
  }
  function normalizeCheckTimeout(step) {
    const normalized = { ...step };
    const hasSeconds = Object.prototype.hasOwnProperty.call(step, "timeout_seconds");
    const hasMilliseconds = Object.prototype.hasOwnProperty.call(step, "timeout_ms");
    if (!hasSeconds && !hasMilliseconds) {
      normalized.timeout_ms = DEFAULT_CHECK_TIMEOUT_MS;
      return normalized;
    }
    if (hasSeconds && !hasMilliseconds && typeof step.timeout_seconds === "number" && Number.isFinite(step.timeout_seconds)) {
      normalized.timeout_ms = step.timeout_seconds * 1e3;
      delete normalized.timeout_seconds;
    }
    return normalized;
  }
  function normalizeHint(hint) {
    if (!isObject2(hint)) return hint;
    const normalized = addDefaults(hint, {
      priority: 1,
      delay_seconds: 0,
      show_once: false,
      display_mode: "triggered",
      style: "info"
    });
    if (!isObject2(hint.trigger)) return normalized;
    normalized.trigger = addDefaults(hint.trigger, {
      after_attempts: 0,
      invalidate_on_condition_false: false
    });
    if (isObject2(hint.trigger.conditions)) {
      normalized.trigger.conditions = normalizeCondition(hint.trigger.conditions);
    }
    return normalized;
  }
  function normalizePayload(payload) {
    return isObject2(payload) ? addDefaults(payload, { case_sensitive: true }) : payload;
  }
  function addDefaults(value, defaults) {
    const object = isObject2(value) ? value : {};
    const normalized = { ...defaults, ...object };
    for (const key of Object.keys(defaults)) {
      if (Object.prototype.hasOwnProperty.call(object, key)) normalized[key] = object[key];
    }
    return normalized;
  }
  function isObject2(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  // src/activity-builder/js/config-tab.js
  var FIELDS = {
    "cfg-title": ["metadata", "title"],
    "cfg-activity-id": ["metadata", "activity_id"],
    "cfg-instructions": ["metadata", "instructions_markdown"],
    "cfg-objectives": ["metadata", "learning_objectives_markdown"],
    "cfg-teacher-notes": ["metadata", "teacher_notes_markdown"]
  };
  var CAPABILITIES = {
    "cap-move-devices": "move_devices",
    "cap-move-nodes": "move_nodes",
    "cap-use-buttons": "use_buttons",
    "cap-load-code": "load_code",
    "cap-edit-code": "edit_code"
  };
  var PANEL_VISIBILITY = {
    "panel-debug": "debug_panel",
    "panel-radio-inspector": "radio_inspector",
    "panel-runtime-log": "runtime_log",
    "panel-env-values": "environment_values",
    "panel-node-coordinates": "node_coordinates",
    "panel-header": "panel_header"
  };
  function initConfigTab() {
    for (const [id, [section, key]] of Object.entries(FIELDS)) {
      const input = document.getElementById(id);
      input.addEventListener("input", () => {
        getConfig()[section][key] = input.value;
        notifyConfigChange("config");
      });
    }
    for (const [id, key] of Object.entries(CAPABILITIES)) {
      const input = document.getElementById(id);
      input.addEventListener("change", () => {
        getConfig().capabilities[key] = input.checked;
        notifyConfigChange("config");
      });
    }
    for (const [id, key] of Object.entries(PANEL_VISIBILITY)) {
      const input = document.getElementById(id);
      input.addEventListener("change", () => {
        getConfig().panel_visibility[key] = input.checked;
        notifyConfigChange("config");
      });
    }
    onConfigChange((config, source) => {
      if (source !== "config") populate(config);
    });
    populate(getConfig());
  }
  function populate(config) {
    for (const [id, [section, key]] of Object.entries(FIELDS)) {
      document.getElementById(id).value = config[section]?.[key] ?? "";
    }
    for (const [id, key] of Object.entries(CAPABILITIES)) {
      document.getElementById(id).checked = config.capabilities?.[key] !== false;
    }
    for (const [id, key] of Object.entries(PANEL_VISIBILITY)) {
      document.getElementById(id).checked = config.panel_visibility[key] === true;
    }
  }

  // src/shared/sim-bridge.js
  var REQUEST_RESPONSES = {
    "load-bundle": "bundle",
    "get-bundle": "bundle",
    "get-display": "display",
    "get-node-positions": "node-positions",
    "press-button": "ack",
    "radio-broadcast": "ack",
    "set-node-level": "ack",
    "add-node": "ack",
    "move-node": "ack",
    "set-scene-flag": "bundle"
  };
  var COMMAND_TYPES = {
    "set-capabilities": true,
    reset: true,
    "set-ui-visibility": true
  };
  var SimBridgeError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "SimBridgeError";
    }
  };
  function connectSimBridge(iframeWindow, targetOrigin) {
    if (!iframeWindow || typeof iframeWindow.postMessage !== "function") {
      throw new TypeError("connectSimBridge requires an iframe window");
    }
    if (typeof targetOrigin !== "string" || targetOrigin.length === 0) {
      throw new TypeError("connectSimBridge requires a target origin");
    }
    let closed = false;
    let readyResolve;
    let isReady = false;
    let nextRequestId = 0;
    const pending = /* @__PURE__ */ new Map();
    const eventListeners = /* @__PURE__ */ new Set();
    const ready = new Promise((resolve) => {
      readyResolve = resolve;
    });
    const onMessage = (messageEvent) => {
      if (closed || messageEvent.source !== iframeWindow) return;
      if (targetOrigin !== "*" && messageEvent.origin !== targetOrigin) return;
      const message = messageEvent.data;
      if (!message || typeof message !== "object" || message.source !== "swarm-sim-bridge" || message.v !== 1) return;
      if (message.type === "ready") {
        isReady = true;
        readyResolve(true);
        return;
      }
      if (message.type === "event") {
        if (!isObject3(message.payload) || !isObject3(message.payload.event)) return;
        for (const listener of eventListeners) listener(message.payload);
        return;
      }
      if (typeof message.id !== "string") return;
      const request2 = pending.get(message.id);
      if (!request2) return;
      if (message.type === "error") {
        settle(request2, () => {
          const detail = isObject3(message.payload) ? message.payload.message : message.payload;
          request2.reject(new SimBridgeError(typeof detail === "string" ? detail : "Simulator bridge request failed"));
        });
        return;
      }
      if (message.type !== request2.expected) return;
      if (message.type === "display") {
        settle(request2, () => {
          if (isObject3(message.payload)) request2.resolve(message.payload);
          else request2.reject(new SimBridgeError("Simulator returned an invalid display response"));
        });
        return;
      }
      if (message.type === "node-positions") {
        settle(request2, () => {
          if (isObject3(message.payload) && Array.isArray(message.payload.positions)) {
            request2.resolve(message.payload);
          } else {
            request2.reject(new SimBridgeError("Simulator returned an invalid node position response"));
          }
        });
        return;
      }
      if (message.type === "ack") {
        settle(request2, () => request2.resolve(true));
        return;
      }
      settle(request2, () => {
        if (typeof message.payload === "string") request2.resolve(message.payload);
        else request2.reject(new SimBridgeError("Simulator returned an invalid bundle response"));
      });
    };
    window.addEventListener("message", onMessage);
    async function sendCommand(type, payload) {
      if (!Object.prototype.hasOwnProperty.call(COMMAND_TYPES, type)) {
        throw new TypeError(`Unsupported simulator bridge command: ${type}`);
      }
      await ready;
      if (closed || !isReady) throw new SimBridgeError("Simulator bridge is closed");
      iframeWindow.postMessage(
        {
          source: "swarm-scorm",
          v: 1,
          type,
          ...payload === void 0 ? {} : { payload }
        },
        targetOrigin
      );
    }
    async function request(type, payload, { timeoutMs, signal } = {}) {
      if (!Object.prototype.hasOwnProperty.call(REQUEST_RESPONSES, type)) {
        throw new TypeError(`Simulator bridge command does not have a response: ${type}`);
      }
      if (signal?.aborted) throw abortError(type, signal);
      if (closed) throw new SimBridgeError("Simulator bridge is closed");
      nextRequestId += 1;
      const id = `swarm-${nextRequestId}`;
      const expected = REQUEST_RESPONSES[type];
      return new Promise((resolve, reject) => {
        const entry = { expected, resolve, reject, cleanup };
        let timer;
        let onAbort;
        function cleanup() {
          if (timer !== void 0) {
            clearTimeout(timer);
            timer = void 0;
          }
          if (onAbort && signal) {
            signal.removeEventListener("abort", onAbort);
            onAbort = void 0;
          }
          if (pending.get(id) === entry) pending.delete(id);
        }
        pending.set(id, entry);
        if (Number.isFinite(timeoutMs)) {
          timer = setTimeout(() => {
            settle(entry, () => reject(new SimBridgeError(
              `Simulator did not answer ${type} within ${Math.max(0, timeoutMs)} ms`
            )));
          }, Math.max(0, timeoutMs));
        }
        if (signal) {
          onAbort = () => {
            settle(entry, () => reject(abortError(type, signal)));
          };
          signal.addEventListener("abort", onAbort, { once: true });
        }
        ready.then(() => {
          if (pending.get(id) !== entry) return;
          if (closed || !isReady) {
            settle(entry, () => reject(new SimBridgeError("Simulator bridge is closed")));
            return;
          }
          try {
            iframeWindow.postMessage(
              {
                source: "swarm-scorm",
                v: 1,
                type,
                id,
                ...payload === void 0 ? {} : { payload }
              },
              targetOrigin
            );
          } catch (error) {
            settle(entry, () => reject(error));
          }
        });
      });
    }
    return {
      ready,
      loadBundle(base64, options) {
        return request("load-bundle", base64, options).then(() => void 0);
      },
      getBundle(options) {
        return request("get-bundle", void 0, options);
      },
      setCapabilities(capabilities) {
        return sendCommand("set-capabilities", capabilities);
      },
      setUiVisibility(visibility) {
        return sendCommand("set-ui-visibility", visibility);
      },
      pressButton(payload, options) {
        return request("press-button", payload, options);
      },
      radioBroadcast(payload, options) {
        return request("radio-broadcast", payload, options);
      },
      setNodeLevel(payload, options) {
        return request("set-node-level", payload, options);
      },
      addNode(payload, options) {
        return request("add-node", payload, options);
      },
      moveNode(payload, options) {
        return request("move-node", payload, options);
      },
      /**
       * Apply one authored starting rule and return the simulator's full current
       * scene bundle. The reply is the snapshot, not an acknowledgement.
       */
      setSceneFlag(payload, options) {
        return request("set-scene-flag", payload, options);
      },
      getDisplay(options) {
        return request("get-display", void 0, options).then((payload) => payload.displays);
      },
      getNodePositions(nodes, options) {
        return request("get-node-positions", { nodes }, options).then((payload) => payload.positions);
      },
      reset() {
        return sendCommand("reset");
      },
      request,
      onEvent(callback) {
        if (typeof callback !== "function") throw new TypeError("onEvent requires a callback");
        eventListeners.add(callback);
        return () => eventListeners.delete(callback);
      },
      close() {
        if (closed) return;
        closed = true;
        window.removeEventListener("message", onMessage);
        readyResolve(false);
        for (const request2 of [...pending.values()]) {
          request2.cleanup();
          request2.reject(new SimBridgeError("Simulator bridge closed before responding"));
        }
        pending.clear();
        eventListeners.clear();
      }
    };
  }
  function abortError(type, signal) {
    const reason = signal?.reason;
    if (reason instanceof Error) return reason;
    return new SimBridgeError(`Simulator request aborted: ${type}`);
  }
  function settle(request, applyOutcome) {
    request.cleanup();
    applyOutcome();
  }
  function isObject3(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  // src/activity-builder/js/scenario-tab.js
  var REQUEST_TIMEOUT_MS = 1e4;
  var UNLOCK_AND_EDIT_TOOLTIP = "Remove this device\u2019s lock and allow source editing. Its pin is unchanged.";
  var LOCKED_NO_SOURCE_TOOLTIP = "Unlock this device, then load or create editable code first.";
  var NO_EDITABLE_CODE_TOOLTIP = "Load or edit code on this device in the simulator first.";
  var bridge;
  var bridgeReady = false;
  var currentBundle;
  var currentProject;
  var bundleLoadChain = Promise.resolve();
  var sceneImportGeneration = 0;
  function initScenarioTab() {
    currentBundle = getSceneBundle();
    currentProject = getSceneProject();
    const iframe = document.getElementById("scenario-iframe");
    const captureButton = document.getElementById("btn-capture-scene");
    const reloadButton = document.getElementById("btn-reload-scene");
    const fileInput = document.getElementById("file-scene");
    void connectFrame(iframe);
    captureButton.addEventListener("click", () => void captureScene());
    reloadButton.addEventListener("click", () => void reloadScene());
    document.getElementById("btn-load-scene").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => void loadSceneFile(fileInput));
    onSceneChange((bundle, project, source) => {
      if (source === "import" || source === "scene-import") {
        sceneImportGeneration += 1;
      }
      currentBundle = bundle;
      currentProject = project;
      if (bundle && !project) {
        try {
          currentProject = decodeSwarmBundle(base64ToBytes(bundle));
          if (source === "import") {
            setSceneBundle(bundle, currentProject, "scene-import");
            return;
          }
        } catch (error) {
          showToast(`Scene bundle could not be read: ${error.message}`, "error");
        }
      }
      renderSceneTable();
      updateSceneButtons();
      if ((source === "import" || source === "scene-import") && currentBundle && bridgeReady) {
        void loadBundleIntoSimulator(currentBundle).catch((error) => {
          setConnectionStatus(
            error instanceof Error ? error.message : "Simulator could not load the imported scene.",
            "error"
          );
        });
      }
    });
    renderSceneTable();
    updateSceneButtons();
  }
  function queueScenarioRequest(run) {
    const activeBridge = bridge;
    const generation = sceneImportGeneration;
    const task = bundleLoadChain.then(() => {
      if (!bridgeReady || activeBridge !== bridge) return void 0;
      return run({ activeBridge, generation });
    });
    bundleLoadChain = task.then(
      () => {
      },
      () => {
      }
    );
    return task;
  }
  async function connectFrame(iframe) {
    bridge?.close();
    bridgeReady = false;
    setConnectionStatus("Connecting to simulator\u2026");
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) {
      setConnectionStatus("Simulator frame is unavailable.", "error");
      return;
    }
    const targetOrigin = new URL("sim/index.html", window.location.href).origin;
    bridge = connectSimBridge(frameWindow, targetOrigin);
    const connectingBridge = bridge;
    iframe.src = "sim/index.html?mode=scenario";
    try {
      const ready = await connectingBridge.ready;
      if (!ready || connectingBridge !== bridge) return;
      bridgeReady = true;
      setConnectionStatus("Simulator connected.");
      updateSceneButtons();
      if (currentBundle) await loadBundleIntoSimulator(currentBundle);
    } catch (error) {
      setConnectionStatus(error instanceof Error ? error.message : "Simulator connection failed.", "error");
    }
  }
  async function captureScene() {
    if (!bridgeReady || !bridge) return;
    try {
      await queueScenarioRequest(async ({ activeBridge, generation }) => {
        const base64 = await activeBridge.getBundle({ timeoutMs: REQUEST_TIMEOUT_MS });
        if (generation !== sceneImportGeneration) return;
        currentBundle = base64;
        currentProject = decodeSwarmBundle(base64ToBytes(base64));
        setSceneBundle(base64, currentProject, "scenario");
        setConnectionStatus("Scene captured.");
      });
    } catch (error) {
      showToast(`Could not capture scene: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }
  async function loadSceneFile(fileInput) {
    const file = fileInput.files?.[0];
    if (!file) return;
    sceneImportGeneration += 1;
    const generation = sceneImportGeneration;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const project = decodeSwarmBundle(bytes);
      if (generation !== sceneImportGeneration) return;
      const base64 = bytesToBase64(bytes);
      await loadBundleIntoSimulator(base64);
      if (generation !== sceneImportGeneration) return;
      currentBundle = base64;
      currentProject = project;
      setSceneBundle(base64, project, "scenario-file");
      setConnectionStatus(`Loaded ${file.name}.`);
    } catch (error) {
      showToast(`Could not load .swarm file: ${error instanceof Error ? error.message : String(error)}`, "error");
    } finally {
      fileInput.value = "";
    }
  }
  async function reloadScene() {
    if (!currentBundle || !bridgeReady) return;
    try {
      await loadBundleIntoSimulator(currentBundle);
      setConnectionStatus("Scene restored in the simulator.");
    } catch (error) {
      showToast(`Could not reload scene: ${error instanceof Error ? error.message : String(error)}`, "error");
    }
  }
  function loadBundleIntoSimulator(base64) {
    return queueScenarioRequest(
      ({ activeBridge }) => activeBridge.loadBundle(base64, { timeoutMs: REQUEST_TIMEOUT_MS })
    );
  }
  async function updateFlags(kind, id, flag, value) {
    if (!bridgeReady || !bridge) return;
    try {
      await queueScenarioRequest(async ({ activeBridge, generation }) => {
        const base64 = await activeBridge.setSceneFlag(
          { kind, id, flag, value },
          { timeoutMs: REQUEST_TIMEOUT_MS }
        );
        if (generation !== sceneImportGeneration) return;
        const project = decodeSwarmBundle(base64ToBytes(base64));
        currentBundle = base64;
        currentProject = project;
        setSceneBundle(base64, project, "scenario");
        setConnectionStatus("Scene rules saved to the simulator.");
      });
    } catch (error) {
      renderSceneTable();
      showToast(
        `Could not save scene rules: ${error instanceof Error ? error.message : String(error)}`,
        "error"
      );
    }
  }
  function renderSceneTable() {
    const emptyState = document.getElementById("scene-empty");
    const tableWrap = document.getElementById("scene-table-wrap");
    const host = document.getElementById("scene-table");
    host.replaceChildren();
    const devices = currentProject?.devices ?? [];
    const nodes = currentProject?.environmentSources ?? [];
    if (!currentProject || devices.length === 0 && nodes.length === 0) {
      emptyState.hidden = false;
      tableWrap.hidden = true;
      return;
    }
    emptyState.hidden = true;
    tableWrap.hidden = false;
    const table = document.createElement("table");
    table.className = "scene-table";
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    for (const label of ["Scene object", "Position", "Locked", "Pinned", "Editable code"]) {
      const cell = document.createElement("th");
      cell.textContent = label;
      headRow.append(cell);
    }
    head.append(headRow);
    const body = document.createElement("tbody");
    for (const device of devices) {
      body.append(renderSceneRow({
        name: device.name,
        id: device.id,
        kind: "device",
        position: device.position,
        locked: device.locked,
        positionPinned: device.positionPinned,
        editableProgram: describeDeviceEditableCode(device),
        onFlagChange: (flag, value) => updateFlags("device", device.id, flag, value)
      }));
    }
    for (const node of nodes) {
      body.append(renderSceneRow({
        name: node.name,
        id: node.id,
        kind: node.type,
        position: node.position,
        locked: node.locked,
        positionPinned: node.positionPinned,
        editableProgram: {
          checked: false,
          disabled: true,
          title: NO_EDITABLE_CODE_TOOLTIP
        },
        onFlagChange: (flag, value) => updateFlags("node", node.id, flag, value)
      }));
    }
    table.append(head, body);
    host.append(table);
  }
  function describeDeviceEditableCode(device) {
    const artifact = device.programArtifactId ? (currentProject?.artifacts ?? []).find((candidate) => candidate.id === device.programArtifactId) : void 0;
    const hasStoredProgram = Boolean(artifact && "program" in artifact);
    const checked = Boolean(
      !device.locked && device.editableProgram && device.editableProgram.baseArtifactId === device.programArtifactId
    );
    if (device.locked) {
      if (hasStoredProgram) {
        return { checked: false, disabled: false, canUnlockAndEdit: true, title: UNLOCK_AND_EDIT_TOOLTIP };
      }
      return { checked: false, disabled: true, canUnlockAndEdit: false, title: LOCKED_NO_SOURCE_TOOLTIP };
    }
    if (!hasStoredProgram) {
      return { checked: false, disabled: true, canUnlockAndEdit: false, title: NO_EDITABLE_CODE_TOOLTIP };
    }
    return { checked, disabled: false, canUnlockAndEdit: false, title: void 0 };
  }
  function renderSceneRow({ name, id, kind, position, locked, positionPinned, editableProgram, onFlagChange }) {
    const row = document.createElement("tr");
    const identity = document.createElement("td");
    identity.className = "scenario-row-name";
    const title = document.createElement("span");
    title.className = "node-name";
    title.textContent = name || kind;
    const identifier = document.createElement("span");
    identifier.className = "node-id";
    identifier.textContent = `${kind} \xB7 ${id}`;
    identity.append(title, identifier);
    const coords = document.createElement("td");
    coords.className = "node-position";
    coords.textContent = `${Math.round(position?.x ?? 0)}, ${Math.round(position?.y ?? 0)}`;
    row.append(identity, coords);
    row.append(
      flagCell("locked", locked, (value) => onFlagChange("locked", value)),
      flagCell("positionPinned", positionPinned, (value) => onFlagChange("positionPinned", value))
    );
    if (editableProgram.canUnlockAndEdit) {
      const cell = document.createElement("td");
      const unlock = document.createElement("button");
      unlock.type = "button";
      unlock.className = "btn btn-small btn-secondary";
      unlock.textContent = "Unlock & enable edits";
      unlock.title = editableProgram.title;
      unlock.addEventListener("click", () => onFlagChange("editableProgram", true));
      cell.append(unlock);
      row.append(cell);
      return row;
    }
    const editable = flagCell(
      "editableProgram",
      editableProgram.checked,
      (value) => onFlagChange("editableProgram", value)
    );
    const checkbox = editable.querySelector("input");
    checkbox.disabled = editableProgram.disabled;
    if (editableProgram.title) checkbox.title = editableProgram.title;
    row.append(editable);
    return row;
  }
  function flagCell(flag, checked, onChange) {
    const cell = document.createElement("td");
    const label = document.createElement("label");
    label.className = "scene-flag";
    label.setAttribute("aria-label", flag);
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked === true;
    input.addEventListener("change", () => onChange(input.checked));
    label.append(input);
    cell.append(label);
    return cell;
  }
  function setConnectionStatus(message, status = "ready") {
    document.getElementById("scenario-status").textContent = message;
    const dot = document.getElementById("scenario-status-dot");
    dot.classList.toggle("is-ready", status === "ready");
    dot.classList.toggle("is-error", status === "error");
  }
  function updateSceneButtons() {
    document.getElementById("btn-capture-scene").disabled = !bridgeReady;
    document.getElementById("btn-reload-scene").disabled = !bridgeReady || !currentBundle;
  }

  // src/activity-builder/js/form-fields.js
  function appendSelect(fields, labelText, selected, options, onChange) {
    const field = makeField(labelText);
    const select = document.createElement("select");
    for (const [value, text] of options) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      option.selected = selected === value;
      select.append(option);
    }
    select.addEventListener("change", () => onChange(select.value));
    field.append(select);
    fields.append(field);
  }
  function appendText(fields, labelText, value, onChange, wide = false) {
    const field = makeField(labelText, wide);
    const input = document.createElement("input");
    input.type = "text";
    input.value = value ?? "";
    input.addEventListener("change", () => onChange(input.value));
    field.append(input);
    fields.append(field);
  }
  function appendNumber(fields, labelText, value, onChange, { integer = false, nullable = false, minimum, step, placeholder } = {}) {
    const field = makeField(labelText);
    const input = document.createElement("input");
    input.type = "number";
    input.step = step ?? (integer ? "1" : "any");
    if (minimum !== void 0) input.min = String(minimum);
    input.value = value == null ? "" : String(value);
    input.placeholder = placeholder ?? (nullable ? "Any" : "");
    input.addEventListener("change", () => {
      if (input.value === "") onChange(nullable ? null : Number.NaN);
      else onChange(Number(input.value));
    });
    field.append(input);
    fields.append(field);
  }
  function appendCheckbox(fields, labelText, checked, onChange) {
    const field = makeField(labelText);
    field.classList.add("condition-checkbox-field");
    const label = document.createElement("label");
    label.className = "inline-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked;
    input.addEventListener("change", () => onChange(input.checked));
    const text = document.createElement("span");
    text.textContent = labelText;
    label.append(input, text);
    field.replaceChildren(label);
    fields.append(field);
  }
  function makeField(labelText, wide = false) {
    const field = document.createElement("div");
    field.className = wide ? "condition-field condition-field--wide" : "condition-field";
    const label = document.createElement("label");
    label.textContent = labelText;
    field.append(label);
    return field;
  }
  function makeButton(text, label, disabled, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "condition-order-button";
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.disabled = disabled;
    button.addEventListener("click", onClick);
    return button;
  }

  // src/activity-builder/js/condition-builder.js
  var CONDITION_LABELS = {
    all: "All conditions",
    any: "Any condition",
    none: "No child condition",
    serial_output: "Serial output",
    button_press: "Button press observed",
    radio_tx: "Radio transmission",
    radio_rx: "Radio reception",
    sensor_reading: "Sensor reading",
    led_display: "LED display",
    node_distance: "Distance between nodes"
  };
  var BUTTON_PRESS_HELP = "Matches a learner or test pressing a simulator button; to check the program\u2019s response, add a separate output check.";
  var NODE_ENDPOINT_KINDS = { device: "device", source: "source" };
  var SENSOR_LABELS = {
    lightLevel: "Light level",
    soundLevel: "Sound level",
    temperatureC: "Temperature",
    magneticForceX: "Magnetic force X",
    magneticForceY: "Magnetic force Y",
    magneticForceZ: "Magnetic force Z"
  };
  function createDefaultCondition(type = "serial_output") {
    switch (type) {
      case "all":
      case "any":
      case "none":
        return { type, conditions: [createDefaultCondition("serial_output")] };
      case "button_press":
        return { type, device_id: null, button: "any", min_count: 1 };
      case "radio_tx":
      case "radio_rx":
        return {
          type,
          device_id: null,
          ...type === "radio_rx" ? { from_device_id: null } : {},
          channel: null,
          group: null,
          payload: null,
          ...type === "radio_rx" ? { rssi_min: null, rssi_max: null } : {},
          min_count: 1
        };
      case "sensor_reading":
        return { type, device_id: null, sensor: "lightLevel", min: null, max: null, min_duration_seconds: 0 };
      case "led_display":
        return { type, device_id: null, layout: "00000\n00000\n00000\n00000\n00000" };
      case "node_distance":
        return { type, node_a: null, node_b: null, min: null, max: 100 };
      case "serial_output":
      default:
        return {
          type: "serial_output",
          device_id: null,
          match: "contains",
          value: "",
          case_sensitive: true,
          min_count: 1
        };
    }
  }
  function renderConditionEditor({
    container,
    condition,
    onChange,
    scene,
    depth = 0,
    onRemove,
    allowNodeDistance = false
  }) {
    if (!container) return;
    const current = condition && typeof condition === "object" ? condition : createDefaultCondition();
    const updateCondition = (nextCondition) => {
      onChange(nextCondition);
      renderConditionEditor({
        container,
        condition: nextCondition,
        onChange,
        scene,
        depth,
        onRemove,
        allowNodeDistance
      });
    };
    container.replaceChildren();
    const wrapper = document.createElement("article");
    const composite = ["all", "any", "none"].includes(current.type);
    wrapper.className = `condition-node condition-node--${current.type}${composite ? " condition-node--composite" : ""}`;
    wrapper.dataset.depth = String(depth);
    const header = document.createElement("div");
    header.className = "condition-node-header";
    const title = document.createElement("strong");
    title.className = "condition-node-title";
    title.textContent = CONDITION_LABELS[current.type] ?? "Condition";
    const summary = document.createElement("span");
    summary.className = "condition-node-summary";
    summary.textContent = conditionSummary(current);
    header.append(title, summary);
    if (onRemove) {
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "condition-remove";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${CONDITION_LABELS[current.type] ?? "condition"}`);
      remove.addEventListener("click", onRemove);
      header.append(remove);
    }
    const body = document.createElement("div");
    body.className = "condition-node-body";
    body.append(renderTypeSelector(current, updateCondition, allowNodeDistance));
    if (composite) {
      body.append(renderComposite(current, updateCondition, scene, depth, allowNodeDistance));
    } else {
      body.append(renderLeafFields(current, updateCondition, scene));
    }
    wrapper.append(header, body);
    container.append(wrapper);
  }
  function renderTypeSelector(condition, onChange, allowNodeDistance) {
    const row = document.createElement("div");
    row.className = "condition-type-row";
    const label = document.createElement("label");
    label.textContent = "Condition type";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Condition type");
    const types = allowNodeDistance ? VALID_CONDITION_TYPES : VALID_CONDITION_TYPES.filter((type) => !VALID_CHECK_ONLY_CONDITION_TYPES.includes(type));
    for (const type of types) {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = CONDITION_LABELS[type] ?? type;
      option.selected = condition.type === type;
      select.append(option);
    }
    select.addEventListener("change", () => {
      const nextCondition = createDefaultCondition(select.value);
      if (Array.isArray(condition.conditions) && Array.isArray(nextCondition.conditions)) {
        nextCondition.conditions = condition.conditions;
      }
      onChange(nextCondition);
    });
    label.append(select);
    row.append(label);
    return row;
  }
  function renderComposite(condition, onChange, scene, depth, allowNodeDistance) {
    const fragment = document.createDocumentFragment();
    const help = document.createElement("p");
    help.className = "field-help";
    help.textContent = condition.type === "all" ? "Every child must match." : condition.type === "any" ? "At least one child must match." : "Passes only when no child condition matches.";
    fragment.append(help);
    const children = Array.isArray(condition.conditions) ? condition.conditions : [];
    const list = document.createElement("div");
    list.className = "condition-children";
    children.forEach((child, index) => {
      const card = document.createElement("div");
      card.className = "condition-card";
      const controls = document.createElement("div");
      controls.className = "condition-order-controls";
      controls.append(
        makeButton("\u2191", "Move condition up", index === 0, () => {
          const next = [...children];
          [next[index - 1], next[index]] = [next[index], next[index - 1]];
          onChange({ ...condition, conditions: next });
        }),
        makeButton("\u2193", "Move condition down", index === children.length - 1, () => {
          const next = [...children];
          [next[index], next[index + 1]] = [next[index + 1], next[index]];
          onChange({ ...condition, conditions: next });
        })
      );
      const host = document.createElement("div");
      host.className = "condition-child-editor";
      renderConditionEditor({
        container: host,
        condition: child,
        scene,
        depth: depth + 1,
        allowNodeDistance,
        onChange: (nextChild) => {
          const next = [...children];
          next[index] = nextChild;
          onChange({ ...condition, conditions: next });
        },
        onRemove: () => onChange({
          ...condition,
          conditions: children.filter((_, childIndex) => childIndex !== index)
        })
      });
      card.append(controls, host);
      list.append(card);
    });
    fragment.append(list);
    const add = makeButton("+ Add condition", "Add child condition", false, () => {
      onChange({ ...condition, conditions: [...children, createDefaultCondition()] });
    });
    add.classList.add("btn", "btn-small", "btn-secondary", "add-sub-condition");
    fragment.append(add);
    return fragment;
  }
  function renderLeafFields(condition, onChange, scene) {
    const fields = document.createElement("div");
    fields.className = "condition-fields";
    if (condition.type === "node_distance") {
      renderNodeDistanceFields(fields, condition, onChange, scene);
      return fields;
    }
    appendDeviceSelect(fields, "Device", condition.device_id, scene, (value) => update(condition, "device_id", value, onChange));
    switch (condition.type) {
      case "serial_output":
        appendSelect(fields, "Match", condition.match, [
          ["contains", "Contains"],
          ["exact", "Exact text"],
          ["regex", "Regular expression"]
        ], (value) => update(condition, "match", value, onChange));
        appendText(fields, "Text", condition.value, (value) => update(condition, "value", value, onChange), true);
        appendCheckbox(
          fields,
          "Case sensitive",
          condition.case_sensitive !== false,
          (value) => update(condition, "case_sensitive", value, onChange)
        );
        appendNumber(
          fields,
          "Minimum matches",
          condition.min_count ?? 1,
          (value) => update(condition, "min_count", value, onChange),
          { integer: true, minimum: 1 }
        );
        break;
      case "button_press":
        appendSelect(fields, "Button", condition.button ?? "any", [
          ["any", "Any button"],
          ["A", "A"],
          ["B", "B"],
          ["AB", "A+B"]
        ], (value) => update(condition, "button", value, onChange));
        appendNumber(
          fields,
          "Minimum presses",
          condition.min_count ?? 1,
          (value) => update(condition, "min_count", value, onChange),
          { integer: true, minimum: 1 }
        );
        appendHelp(fields, BUTTON_PRESS_HELP);
        break;
      case "radio_tx":
        appendNumber(
          fields,
          "Radio channel \xB7 any",
          condition.channel,
          (value) => update(condition, "channel", value, onChange),
          { integer: true, nullable: true }
        );
        appendNumber(
          fields,
          "Radio group \xB7 any",
          condition.group,
          (value) => update(condition, "group", value, onChange),
          { integer: true, nullable: true }
        );
        appendPayloadFields(fields, condition.payload, (value) => update(condition, "payload", value, onChange));
        appendNumber(
          fields,
          "Minimum transmissions",
          condition.min_count ?? 1,
          (value) => update(condition, "min_count", value, onChange),
          { integer: true, minimum: 1 }
        );
        break;
      case "radio_rx":
        appendDeviceSelect(
          fields,
          "Sender \xB7 any",
          condition.from_device_id,
          scene,
          (value) => update(condition, "from_device_id", value, onChange)
        );
        appendNumber(
          fields,
          "Radio channel \xB7 any",
          condition.channel,
          (value) => update(condition, "channel", value, onChange),
          { integer: true, nullable: true }
        );
        appendNumber(
          fields,
          "Radio group \xB7 any",
          condition.group,
          (value) => update(condition, "group", value, onChange),
          { integer: true, nullable: true }
        );
        appendPayloadFields(fields, condition.payload, (value) => update(condition, "payload", value, onChange));
        appendNumber(
          fields,
          "RSSI minimum \xB7 any",
          condition.rssi_min,
          (value) => update(condition, "rssi_min", value, onChange),
          { nullable: true }
        );
        appendNumber(
          fields,
          "RSSI maximum \xB7 any",
          condition.rssi_max,
          (value) => update(condition, "rssi_max", value, onChange),
          { nullable: true }
        );
        appendNumber(
          fields,
          "Minimum receptions",
          condition.min_count ?? 1,
          (value) => update(condition, "min_count", value, onChange),
          { integer: true, minimum: 1 }
        );
        break;
      case "sensor_reading":
        appendSelect(
          fields,
          "Sensor",
          condition.sensor ?? "lightLevel",
          Object.entries(SENSOR_LABELS),
          (value) => update(condition, "sensor", value, onChange)
        );
        appendNumber(
          fields,
          "Minimum value \xB7 any",
          condition.min,
          (value) => update(condition, "min", value, onChange),
          { nullable: true }
        );
        appendNumber(
          fields,
          "Maximum value \xB7 any",
          condition.max,
          (value) => update(condition, "max", value, onChange),
          { nullable: true }
        );
        appendNumber(
          fields,
          "Held for seconds",
          condition.min_duration_seconds ?? 0,
          (value) => update(condition, "min_duration_seconds", value, onChange),
          { minimum: 0, step: "any" }
        );
        break;
      case "led_display": {
        const layoutField = makeField("Layout", true);
        const textarea = document.createElement("textarea");
        textarea.className = "mono";
        textarea.rows = 5;
        textarea.spellcheck = false;
        textarea.value = condition.layout ?? "";
        textarea.addEventListener("change", () => update(condition, "layout", textarea.value, onChange));
        const help = document.createElement("small");
        help.className = "field-help";
        help.textContent = "Five rows of five characters. 0 or . = off; 1\u20139 or # = on for grading.";
        layoutField.append(textarea, help);
        fields.append(layoutField);
        break;
      }
    }
    return fields;
  }
  function renderNodeDistanceFields(fields, condition, onChange, scene) {
    appendNodeEndpointSelect(
      fields,
      "First node",
      condition.node_a,
      scene,
      (value) => update(condition, "node_a", value, onChange)
    );
    appendNodeEndpointSelect(
      fields,
      "Second node",
      condition.node_b,
      scene,
      (value) => update(condition, "node_b", value, onChange)
    );
    appendNumber(
      fields,
      "Minimum distance (canvas units)",
      condition.min,
      (value) => update(condition, "min", value, onChange),
      { nullable: true, minimum: 0 }
    );
    appendNumber(
      fields,
      "Maximum distance (canvas units)",
      condition.max,
      (value) => update(condition, "max", value, onChange),
      { nullable: true, minimum: 0 }
    );
  }
  function appendNodeEndpointSelect(fields, label, selected, scene, onChange) {
    const options = sceneNodeOptions(scene);
    const encoded = selected && typeof selected === "object" ? JSON.stringify({ kind: selected.kind, id: selected.id }) : "";
    if (encoded && !options.some(([value]) => value === encoded)) {
      options.push([encoded, `${selected.id} \xB7 ${selected.kind} \xB7 missing from scene`]);
    }
    appendSelect(fields, label, encoded, [
      ["", "Select node"],
      ...options
    ], (value) => onChange(decodeNodeEndpoint(value)));
  }
  function sceneNodeOptions(scene) {
    const devices = Array.isArray(scene?.devices) ? scene.devices : [];
    const sources = Array.isArray(scene?.environmentSources) ? scene.environmentSources : [];
    return [
      ...devices.map((device) => [encodeNodeEndpoint("device", device.id), `${device.name} \xB7 device \xB7 ${device.id}`]),
      ...sources.map((source) => [encodeNodeEndpoint("source", source.id), `${source.name} \xB7 source \xB7 ${source.id}`])
    ];
  }
  function encodeNodeEndpoint(kind, id) {
    return JSON.stringify({ kind, id });
  }
  function decodeNodeEndpoint(value) {
    if (!value) return null;
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
    if (!parsed || !NODE_ENDPOINT_KINDS[parsed.kind] || typeof parsed.id !== "string" || parsed.id === "") {
      return null;
    }
    return { kind: parsed.kind, id: parsed.id };
  }
  function appendHelp(fields, text) {
    const help = document.createElement("p");
    help.className = "field-help";
    help.textContent = text;
    fields.append(help);
  }
  function appendPayloadFields(fields, payload, onChange) {
    const enabled = payload !== null && payload !== void 0;
    appendCheckbox(fields, "Match packet payload", enabled, (checked) => {
      onChange(checked ? { match: "contains", value: "", case_sensitive: true } : null);
    });
    if (!enabled) return;
    appendSelect(fields, "Payload match", payload.match ?? "contains", [
      ["contains", "Contains text"],
      ["exact", "Exact text"],
      ["regex", "Regular expression"],
      ["hex", "Hex bytes"]
    ], (value) => onChange({ ...payload, match: value }));
    appendText(
      fields,
      payload.match === "hex" ? "Hex bytes" : "Payload text",
      payload.value ?? "",
      (value) => onChange({ ...payload, value }),
      true
    );
    if (payload.match !== "hex") {
      appendCheckbox(
        fields,
        "Payload case sensitive",
        payload.case_sensitive !== false,
        (value) => onChange({ ...payload, case_sensitive: value })
      );
    }
  }
  function appendDeviceSelect(fields, label, selected, scene, onChange) {
    const devices = Array.isArray(scene?.devices) ? scene.devices : [];
    appendSelect(fields, label, selected ?? "", [
      ["", "Any device"],
      ...devices.map((device) => [device.id, `${device.name} \xB7 ${device.id}`])
    ], (value) => onChange(value === "" ? null : value));
  }
  function update(condition, key, value, onChange) {
    onChange({ ...condition, [key]: value });
  }
  function conditionSummary(condition) {
    if (!condition || typeof condition !== "object") return "";
    if (["all", "any", "none"].includes(condition.type)) {
      return `${condition.conditions?.length ?? 0} sub-condition(s)`;
    }
    if (condition.type === "serial_output") return condition.value || "Serial text";
    if (condition.type === "button_press") return condition.button ?? "any button";
    if (condition.type === "sensor_reading") return SENSOR_LABELS[condition.sensor] ?? "Sensor";
    if (condition.type === "led_display") return "LED layout";
    if (condition.type === "node_distance") return nodeDistanceSummary(condition);
    return condition.type === "radio_rx" ? "Received packet" : "Transmitted packet";
  }
  function nodeDistanceSummary(condition) {
    const hasMin = Number.isFinite(condition.min);
    const hasMax = Number.isFinite(condition.max);
    if (hasMin && hasMax) {
      return condition.min === condition.max ? `${condition.min} units` : `${condition.min}\u2013${condition.max} units`;
    }
    if (hasMax) return `\u2264 ${condition.max} units`;
    if (hasMin) return `\u2265 ${condition.min} units`;
    return "No distance range";
  }

  // src/activity-builder/js/list-reorder.js
  var DRAGGING_CLASS = "dragging";
  var DRAG_OVER_BEFORE_CLASS = "drag-over-before";
  var DRAG_OVER_AFTER_CLASS = "drag-over-after";
  function enableListReordering(container, { itemSelector, onMove }) {
    let draggedIndex = null;
    const clearDropIndicators = () => {
      container.querySelectorAll(itemSelector).forEach((item) => {
        item.classList.remove(DRAGGING_CLASS, DRAG_OVER_BEFORE_CLASS, DRAG_OVER_AFTER_CLASS);
      });
    };
    container.querySelectorAll(itemSelector).forEach((item) => {
      item.addEventListener("dragstart", (event) => {
        draggedIndex = getItemIndex(item);
        if (draggedIndex === null) return;
        item.classList.add(DRAGGING_CLASS);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(draggedIndex));
      });
      item.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (draggedIndex === null) return;
        const before = isPointerInTopHalf(item, event.clientY);
        item.classList.toggle(DRAG_OVER_BEFORE_CLASS, before);
        item.classList.toggle(DRAG_OVER_AFTER_CLASS, !before);
      });
      item.addEventListener("dragleave", () => {
        item.classList.remove(DRAG_OVER_BEFORE_CLASS, DRAG_OVER_AFTER_CLASS);
      });
      item.addEventListener("drop", (event) => {
        event.preventDefault();
        if (draggedIndex === null) return;
        const targetIndex = getItemIndex(item);
        if (targetIndex === null) return;
        const position = isPointerInTopHalf(item, event.clientY) ? "before" : "after";
        onMove(draggedIndex, targetIndex, position);
        draggedIndex = null;
      });
      item.addEventListener("dragend", () => {
        draggedIndex = null;
        clearDropIndicators();
      });
    });
  }
  function moveListItem(items, fromIndex, targetIndex, position) {
    if (!Array.isArray(items) || !isIndexInRange(items, fromIndex) || !isIndexInRange(items, targetIndex)) {
      return null;
    }
    if (fromIndex === targetIndex) {
      return { fromIndex, insertIndex: fromIndex, changed: false };
    }
    const [moved] = items.splice(fromIndex, 1);
    let insertIndex = targetIndex;
    if (fromIndex < targetIndex) {
      insertIndex -= 1;
    }
    if (position === "after") {
      insertIndex += 1;
    }
    insertIndex = Math.max(0, Math.min(insertIndex, items.length));
    items.splice(insertIndex, 0, moved);
    return { fromIndex, insertIndex, changed: true };
  }
  function getSelectionIndexAfterMove(selectedIndex, fromIndex, insertIndex) {
    if (selectedIndex === fromIndex) return insertIndex;
    if (fromIndex < selectedIndex && insertIndex >= selectedIndex) return selectedIndex - 1;
    if (fromIndex > selectedIndex && insertIndex <= selectedIndex) return selectedIndex + 1;
    return selectedIndex;
  }
  function getItemIndex(item) {
    const index = parseInt(item.dataset.index, 10);
    return Number.isInteger(index) ? index : null;
  }
  function isIndexInRange(items, index) {
    return Number.isInteger(index) && index >= 0 && index < items.length;
  }
  function isPointerInTopHalf(element, pointerY) {
    const rect = element.getBoundingClientRect();
    return pointerY < rect.top + rect.height / 2;
  }

  // src/activity-builder/js/hints-tab.js
  var selectedHintIndex = -1;
  var LED_FENCE_HELP = "For a micro:bit display, put five rows of five digits between standalone ```led and ``` lines. 0 is off; # is 9.";
  var sectionOpenState = /* @__PURE__ */ new WeakMap();
  function initHintsTab() {
    document.getElementById("btn-add-hint").addEventListener("click", addHint);
    onConfigChange((config, source) => {
      if (source === "hints") {
        renderHintList();
        return;
      }
      clampSelection(config.hints);
      renderHintsTab();
    });
    if (selectedHintIndex < 0 && getConfig().hints.length > 0) selectedHintIndex = 0;
    onSceneChange(() => renderHintEditor());
    renderHintsTab();
  }
  function addHint() {
    const config = getConfig();
    const id = makeUniqueId("hint", config.hints);
    config.hints.push({
      id,
      trigger: {
        event: "sim_event",
        conditions: createDefaultCondition("serial_output"),
        after_attempts: 0,
        invalidate_on_condition_false: false
      },
      message: "Look for a change in the simulation.",
      priority: 1,
      delay_seconds: 0,
      show_once: false,
      display_mode: "triggered",
      style: "info"
    });
    selectedHintIndex = config.hints.length - 1;
    notifyConfigChange("hints");
    renderHintsTab();
  }
  function removeHint(index) {
    const config = getConfig();
    config.hints.splice(index, 1);
    if (selectedHintIndex === index) selectedHintIndex = Math.min(index, config.hints.length - 1);
    else if (selectedHintIndex > index) selectedHintIndex -= 1;
    notifyConfigChange("hints");
    renderHintsTab();
  }
  function renderHintsTab() {
    renderHintList();
    renderHintEditor();
  }
  function renderHintList() {
    const hints = getConfig().hints;
    const list = document.getElementById("hint-list");
    list.replaceChildren();
    document.getElementById("hint-count").textContent = String(hints.length);
    if (hints.length === 0) {
      list.append(emptyRow("No hints yet. Add one when learners need a timely nudge."));
      return;
    }
    hints.forEach((hint, index) => {
      const item = document.createElement("div");
      item.className = `list-item list-item-reorderable${index === selectedHintIndex ? " selected" : ""}`;
      item.draggable = true;
      item.dataset.index = String(index);
      const select = document.createElement("button");
      select.type = "button";
      select.className = "list-item-select";
      select.setAttribute("aria-pressed", String(index === selectedHintIndex));
      select.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");
      select.title = "Drag to reorder. Alt+Arrow moves this row.";
      const text = document.createElement("span");
      text.className = "list-item-title";
      text.textContent = hint.message?.trim() || hint.id || `Hint ${index + 1}`;
      const meta = document.createElement("small");
      meta.className = "list-item-meta";
      meta.textContent = `${hint.trigger?.event ?? "unconfigured"} \xB7 priority ${hint.priority ?? 1}`;
      select.append(text, meta);
      select.addEventListener("click", () => selectHint(index));
      select.addEventListener("keydown", (event) => {
        if (!event.altKey || event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        const target = index + (event.key === "ArrowUp" ? -1 : 1);
        if (target < 0 || target >= getConfig().hints.length) return;
        event.preventDefault();
        moveHint(index, target, event.key === "ArrowUp" ? "before" : "after", true);
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "list-item-remove";
      remove.setAttribute("aria-label", `Remove hint ${hint.id}`);
      remove.textContent = "\xD7";
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        removeHint(index);
      });
      item.append(select, remove);
      list.append(item);
    });
    enableListReordering(list, {
      itemSelector: ".list-item",
      onMove: moveHint
    });
  }
  function moveHint(fromIndex, targetIndex, position, restoreFocus = false) {
    const hints = getConfig().hints;
    const moved = moveListItem(hints, fromIndex, targetIndex, position);
    if (!moved || !moved.changed) return;
    selectedHintIndex = getSelectionIndexAfterMove(selectedHintIndex, moved.fromIndex, moved.insertIndex);
    notifyConfigChange("hints");
    renderHintList();
    renderHintEditor();
    if (restoreFocus) {
      const button = document.getElementById("hint-list")?.querySelector(`.list-item[data-index="${moved.insertIndex}"] .list-item-select`);
      if (button) button.focus();
    }
  }
  function renderHintEditor() {
    const container = document.getElementById("hint-editor-content");
    const hint = getConfig().hints[selectedHintIndex];
    container.replaceChildren();
    if (!hint) {
      container.className = "empty-state";
      const title = document.createElement("strong");
      title.textContent = "Select a hint to edit";
      const note = document.createElement("p");
      note.textContent = "Add a hint to define its trigger, message, and display style.";
      container.append(title, note);
      return;
    }
    container.className = "";
    const heading = document.createElement("div");
    heading.className = "detail-heading";
    heading.innerHTML = '<div><p class="eyebrow">Scaffold settings</p><h3>Hint definition</h3></div>';
    container.append(heading);
    const grid = document.createElement("div");
    grid.className = "field-grid";
    appendTextField(grid, "Hint ID", hint.id, (value) => updateHint({ id: value }));
    appendSelectField(grid, "Trigger event", hint.trigger.event, [
      ["sim_event", "Simulation event"],
      ["test_fail", "Failed Check"],
      ["manual", "Manual request"]
    ], (value) => updateTrigger({ event: value }));
    appendTextField(grid, "Message", hint.message, (value) => updateHint({ message: value }), true, true, LED_FENCE_HELP);
    appendNumberField(grid, "Priority", hint.priority, (value) => updateHint({ priority: value }), { minimum: 1, integer: true });
    appendNumberField(grid, "Delay \xB7 seconds", hint.delay_seconds, (value) => updateHint({ delay_seconds: value }), { minimum: 0 });
    appendNumberField(
      grid,
      "After Check attempts",
      hint.trigger.after_attempts,
      (value) => updateTrigger({ after_attempts: value }),
      { minimum: 0, integer: true }
    );
    appendSelectField(grid, "Display mode", hint.display_mode, [
      ["triggered", "Show when triggered"],
      ["checklist", "Always show in checklist"]
    ], (value) => updateHint({ display_mode: value }));
    appendSelectField(grid, "Hint style", hint.style, [
      ["info", "Information"],
      ["success", "Success"],
      ["warning", "Warning"]
    ], (value) => updateHint({ style: value }));
    appendCheckboxField(grid, "Show once", hint.show_once, (value) => updateHint({ show_once: value }));
    appendCheckboxField(
      grid,
      "Hide again if condition becomes false",
      hint.trigger.invalidate_on_condition_false,
      (value) => updateTrigger({ invalidate_on_condition_false: value }),
      true
    );
    container.append(grid);
    const conditionShell = document.createElement("details");
    conditionShell.className = "condition-editor-shell";
    conditionShell.open = readSectionState(hint);
    const conditionHeading = document.createElement("summary");
    conditionHeading.className = "condition-editor-title";
    conditionHeading.innerHTML = "<strong>Effect condition</strong><small>Evaluated against simulator events</small>";
    const conditionHost = document.createElement("div");
    conditionHost.className = "condition-editor-body";
    conditionShell.append(conditionHeading, conditionHost);
    conditionShell.addEventListener("toggle", () => {
      sectionOpenState.set(hint, { condition: conditionShell.open });
    });
    container.append(conditionShell);
    renderConditionEditor({
      container: conditionHost,
      condition: hint.trigger.conditions,
      scene: getSceneProject(),
      onChange: (conditions) => updateTrigger({ conditions })
    });
    function updateHint(patch) {
      const config = getConfig();
      const previous = config.hints[selectedHintIndex];
      const next = { ...previous, ...patch };
      config.hints[selectedHintIndex] = next;
      transferSectionState(previous, next);
      notifyConfigChange("hints");
      renderHintList();
    }
    function updateTrigger(patch) {
      const config = getConfig();
      const current = config.hints[selectedHintIndex];
      const next = { ...current, trigger: { ...current.trigger, ...patch } };
      config.hints[selectedHintIndex] = next;
      transferSectionState(current, next);
      notifyConfigChange("hints");
      renderHintList();
    }
  }
  function readSectionState(hint) {
    const state2 = sectionOpenState.get(hint);
    if (!state2 || typeof state2.condition !== "boolean") return true;
    return state2.condition;
  }
  function transferSectionState(previous, next) {
    if (!previous || !next) return;
    const state2 = sectionOpenState.get(previous);
    if (state2) sectionOpenState.set(next, state2);
  }
  function selectHint(index) {
    const restoreFocus = document.activeElement?.classList.contains("list-item-select") === true;
    selectedHintIndex = index;
    renderHintList();
    renderHintEditor();
    if (restoreFocus) {
      const button = document.getElementById("hint-list")?.querySelector(`.list-item[data-index="${index}"] .list-item-select`);
      if (button) button.focus();
    }
  }
  function clampSelection(hints) {
    if (hints.length === 0) selectedHintIndex = -1;
    else if (selectedHintIndex < 0 || selectedHintIndex >= hints.length) selectedHintIndex = 0;
  }
  function makeUniqueId(prefix, items) {
    let serial = items.length + 1;
    const existing = new Set(items.map((item) => item.id));
    while (existing.has(`${prefix}-${serial}`)) serial += 1;
    return `${prefix}-${serial}`;
  }
  function emptyRow(message) {
    const note = document.createElement("p");
    note.className = "empty-note";
    note.textContent = message;
    return note;
  }
  function appendTextField(parent, labelText, value, onChange, wide = false, textarea = false, help = "") {
    const field = makeField2(labelText, wide);
    const input = document.createElement(textarea ? "textarea" : "input");
    if (!textarea) input.type = "text";
    input.value = value ?? "";
    input.addEventListener("change", () => onChange(input.value));
    field.append(input);
    if (help) {
      const note = document.createElement("small");
      note.className = "field-help";
      note.textContent = help;
      field.append(note);
    }
    parent.append(field);
  }
  function appendNumberField(parent, labelText, value, onChange, { minimum, integer = false } = {}) {
    const field = makeField2(labelText);
    const input = document.createElement("input");
    input.type = "number";
    input.min = String(minimum);
    input.step = integer ? "1" : "any";
    input.value = value ?? "";
    input.addEventListener("change", () => onChange(input.value === "" ? Number.NaN : Number(input.value)));
    field.append(input);
    parent.append(field);
  }
  function appendSelectField(parent, labelText, value, options, onChange) {
    const field = makeField2(labelText);
    const select = document.createElement("select");
    for (const [optionValue, label] of options) {
      const option = document.createElement("option");
      option.value = optionValue;
      option.textContent = label;
      option.selected = value === optionValue;
      select.append(option);
    }
    select.addEventListener("change", () => onChange(select.value));
    field.append(select);
    parent.append(field);
  }
  function appendCheckboxField(parent, labelText, checked, onChange, wide = false) {
    const field = makeField2("", wide);
    const label = document.createElement("label");
    label.className = "inline-toggle";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = checked === true;
    input.addEventListener("change", () => onChange(input.checked));
    const text = document.createElement("span");
    text.textContent = labelText;
    label.append(input, text);
    field.append(label);
    parent.append(field);
  }
  function makeField2(labelText, wide = false) {
    const field = document.createElement("div");
    field.className = wide ? "field field--wide" : "field";
    if (labelText) {
      const label = document.createElement("label");
      label.textContent = labelText;
      field.append(label);
    }
    return field;
  }

  // src/activity-builder/js/action-builder.js
  var ACTION_LABELS = {
    radio_broadcast: "Radio broadcast",
    press_button: "Press button",
    set_node_level: "Set node level",
    add_node: "Add node",
    move_node: "Move node"
  };
  var BUTTON_LABELS = { A: "A", B: "B", AB: "A+B" };
  var NODE_TYPE_LABELS = { light: "Light", sound: "Sound", temperature: "Temperature", magnet: "Magnet" };
  var LEVEL_LABELS = {
    light: "Light intensity",
    sound: "Sound intensity",
    temperature: "Temperature \xB0C",
    magnet: "Magnetic strength \xB5T"
  };
  function createDefaultAction(type = "press_button") {
    switch (type) {
      case "radio_broadcast":
        return { type, device_id: null, channel: null, group: null, payload: "", count: 1, interval_ms: 0 };
      case "set_node_level":
        return { type, node_id: null, value: 0 };
      case "move_node":
        return { type, node_id: null, x: 0, y: 0 };
      case "add_node":
        return { type, node_type: "light", x: 0, y: 0, level: null, duration_seconds: 10 };
      case "press_button":
      default:
        return { type: "press_button", device_id: null, button: "A", count: 1, interval_ms: 0 };
    }
  }
  function actionSummary(action) {
    if (!action || typeof action !== "object") return "";
    if (action.type === "radio_broadcast") return action.payload ? `Radio "${action.payload}"` : "Radio broadcast";
    if (action.type === "press_button") return `Button ${BUTTON_LABELS[action.button] ?? action.button ?? "A"}`;
    if (action.type === "set_node_level") return `Level ${action.value ?? 0}`;
    if (action.type === "move_node") {
      return `Move to (${formatCoordinate(action.x)}, ${formatCoordinate(action.y)})`;
    }
    if (action.type === "add_node") return `Add ${action.node_type ?? "light"} node`;
    return "Action";
  }
  function actionTitle(action) {
    if (!action || typeof action !== "object") return "Action";
    return ACTION_LABELS[action.type] ?? "Action";
  }
  function formatCoordinate(value) {
    return Number.isFinite(value) ? String(value) : "\u2014";
  }
  function renderActionEditor({ container, action, scene, onChange }) {
    if (!container) return;
    const current = action && typeof action === "object" ? action : createDefaultAction();
    const update2 = (key, value) => onChange({ ...current, [key]: value });
    container.replaceChildren();
    const card = document.createElement("article");
    card.className = "action-card";
    const typeRow = document.createElement("div");
    typeRow.className = "action-type-row";
    const typeField = makeField("Action type");
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Action type");
    for (const type of VALID_ACTION_TYPES) {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = ACTION_LABELS[type] ?? type;
      option.selected = current.type === type;
      select.append(option);
    }
    select.addEventListener("change", () => onChange(createDefaultAction(select.value)));
    typeField.append(select);
    typeRow.append(typeField);
    card.append(typeRow);
    const fields = document.createElement("div");
    fields.className = "action-fields";
    switch (current.type) {
      case "radio_broadcast":
        appendDeviceField(fields, current.device_id, scene, (value) => update2("device_id", value));
        appendNumber(
          fields,
          "Radio channel \xB7 device default",
          current.channel,
          (value) => update2("channel", value),
          { integer: true, nullable: true, placeholder: "Device default" }
        );
        appendNumber(
          fields,
          "Radio group \xB7 device default",
          current.group,
          (value) => update2("group", value),
          { integer: true, nullable: true, placeholder: "Device default" }
        );
        appendText(fields, "Payload text", current.payload, (value) => update2("payload", value), true);
        appendNumber(
          fields,
          "Repeat count",
          current.count,
          (value) => update2("count", value),
          { integer: true, minimum: 1 }
        );
        appendNumber(
          fields,
          "Interval ms",
          current.interval_ms,
          (value) => update2("interval_ms", value),
          { integer: true, minimum: 0 }
        );
        break;
      case "press_button":
        appendDeviceField(fields, current.device_id, scene, (value) => update2("device_id", value));
        appendSelect(
          fields,
          "Button",
          current.button ?? "A",
          VALID_ACTION_BUTTONS.map((button) => [button, BUTTON_LABELS[button] ?? button]),
          (value) => update2("button", value)
        );
        appendNumber(
          fields,
          "Repeat count",
          current.count,
          (value) => update2("count", value),
          { integer: true, minimum: 1 }
        );
        appendNumber(
          fields,
          "Interval ms",
          current.interval_ms,
          (value) => update2("interval_ms", value),
          { integer: true, minimum: 0 }
        );
        break;
      case "set_node_level":
        appendNodeField(fields, current.node_id, scene, (value) => update2("node_id", value));
        appendNumber(
          fields,
          LEVEL_LABELS[sceneNodes(scene).find((node) => node.id === current.node_id)?.type] ?? "Level",
          current.value,
          (value) => update2("value", value)
        );
        break;
      case "move_node": {
        appendNodeField(fields, current.node_id, scene, (value) => {
          const node = sceneNodes(scene).find((candidate) => candidate.id === value);
          const position = node?.position;
          onChange({
            ...current,
            node_id: value,
            ...value && position ? { x: position.x, y: position.y } : {}
          });
        });
        appendNumber(fields, "X", current.x, (value) => update2("x", value));
        appendNumber(fields, "Y", current.y, (value) => update2("y", value));
        break;
      }
      case "add_node": {
        appendSelect(
          fields,
          "Node type",
          current.node_type ?? "light",
          VALID_NODE_TYPES.map((type) => [type, NODE_TYPE_LABELS[type] ?? type]),
          (value) => update2("node_type", value)
        );
        appendNumber(fields, "X", current.x, (value) => update2("x", value));
        appendNumber(fields, "Y", current.y, (value) => update2("y", value));
        appendNumber(
          fields,
          "Level \xB7 type default",
          current.level,
          (value) => update2("level", value),
          { nullable: true, placeholder: "Type default" }
        );
        const durationField = makeField("Duration seconds");
        const durationInput = document.createElement("input");
        durationInput.type = "number";
        durationInput.step = "any";
        durationInput.min = "0";
        durationInput.value = current.duration_seconds == null ? "" : String(current.duration_seconds);
        durationInput.addEventListener("change", () => {
          update2("duration_seconds", durationInput.value === "" ? 10 : Number(durationInput.value));
        });
        const help = document.createElement("small");
        help.className = "field-help";
        help.textContent = "0 keeps the node permanently";
        durationField.append(durationInput, help);
        fields.append(durationField);
        break;
      }
    }
    card.append(fields);
    container.append(card);
  }
  function appendDeviceField(fields, selected, scene, onChange) {
    const devices = Array.isArray(scene?.devices) ? scene.devices : [];
    appendSelect(fields, "Device", selected ?? "", [
      ["", "Select device"],
      ...devices.map((device) => [device.id, `${device.name} \xB7 ${device.id}`])
    ], (value) => onChange(value === "" ? null : value));
  }
  function appendNodeField(fields, selected, scene, onChange) {
    const nodes = sceneNodes(scene);
    const options = nodes.map((node) => [node.id, `${node.name} \xB7 ${node.type}`]);
    if (selected && !nodes.some((node) => node.id === selected)) {
      options.push([selected, `${selected} \xB7 missing from scene`]);
    }
    appendSelect(fields, "Node", selected ?? "", [
      ["", "Select node"],
      ...options
    ], (value) => onChange(value === "" ? null : value));
  }
  function sceneNodes(scene) {
    return Array.isArray(scene?.environmentSources) ? scene.environmentSources : [];
  }

  // src/activity-builder/js/tests-tab.js
  var DEFAULT_TIMEOUT_MS = 5e3;
  var LED_FENCE_HELP2 = "For a micro:bit display, put five rows of five digits between standalone ```led and ``` lines. 0 is off; # is 9.";
  var selectedTestIndex = -1;
  var sectionOpenState2 = /* @__PURE__ */ new WeakMap();
  var collapsedCards = /* @__PURE__ */ new WeakSet();
  function initTestsTab() {
    document.getElementById("btn-add-test").addEventListener("click", addTest);
    onConfigChange((config, source) => {
      if (source === "tests") {
        renderTestList();
        updatePointsIndicator();
        return;
      }
      clampSelection2(config.evaluation.test_cases);
      renderTestsTab();
    });
    clampSelection2(getConfig().evaluation.test_cases);
    onSceneChange(() => renderTestEditor());
    renderTestsTab();
  }
  function currentTest() {
    return getConfig().evaluation.test_cases[selectedTestIndex];
  }
  function addTest() {
    const config = getConfig();
    const tests = config.evaluation.test_cases;
    tests.push({
      id: makeUniqueId2(tests),
      points: 1,
      trigger: [createDefaultAction("press_button")],
      steps: [{ type: "check", condition: createDefaultCondition("serial_output"), timeout_ms: DEFAULT_TIMEOUT_MS }]
    });
    selectedTestIndex = tests.length - 1;
    notifyConfigChange("tests");
    renderTestsTab();
  }
  function removeTest(index) {
    const tests = getConfig().evaluation.test_cases;
    tests.splice(index, 1);
    if (selectedTestIndex === index) selectedTestIndex = Math.min(index, tests.length - 1);
    else if (selectedTestIndex > index) selectedTestIndex -= 1;
    notifyConfigChange("tests");
    renderTestsTab();
  }
  function renderTestsTab() {
    renderTestList();
    renderTestEditor();
    updatePointsIndicator();
  }
  function renderTestList() {
    const tests = getConfig().evaluation.test_cases;
    const list = document.getElementById("test-list");
    list.replaceChildren();
    document.getElementById("test-count").textContent = String(tests.length);
    if (tests.length === 0) {
      const note = document.createElement("p");
      note.className = "empty-note";
      note.textContent = "At least one graded test is required for a score.";
      list.append(note);
      return;
    }
    tests.forEach((testCase, index) => {
      const item = document.createElement("div");
      item.className = `list-item list-item-reorderable${index === selectedTestIndex ? " selected" : ""}`;
      item.draggable = true;
      item.dataset.index = String(index);
      const select = document.createElement("button");
      select.type = "button";
      select.className = "list-item-select";
      select.setAttribute("aria-pressed", String(index === selectedTestIndex));
      select.setAttribute("aria-keyshortcuts", "Alt+ArrowUp Alt+ArrowDown");
      select.title = "Drag to reorder. Alt+Arrow moves this row.";
      const title = document.createElement("span");
      title.className = "list-item-title";
      title.textContent = testCase.id || `Test ${index + 1}`;
      const meta = document.createElement("small");
      meta.className = "list-item-meta";
      meta.textContent = `${testCase.points ?? 1} pt(s) \xB7 ${testCase.trigger?.length ?? 0} action(s) \xB7 ${testCase.steps?.length ?? 0} step(s)`;
      select.append(title, meta);
      select.addEventListener("click", () => selectTest(index));
      select.addEventListener("keydown", (event) => {
        if (!event.altKey || event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        const target = index + (event.key === "ArrowUp" ? -1 : 1);
        if (target < 0 || target >= getConfig().evaluation.test_cases.length) return;
        event.preventDefault();
        moveTest(index, target, event.key === "ArrowUp" ? "before" : "after", true);
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "list-item-remove";
      remove.textContent = "\xD7";
      remove.setAttribute("aria-label", `Remove test ${testCase.id}`);
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        removeTest(index);
      });
      item.append(select, remove);
      list.append(item);
    });
    enableListReordering(list, {
      itemSelector: ".list-item",
      onMove: moveTest
    });
  }
  function renderTestEditor() {
    const container = document.getElementById("test-editor-content");
    const testCase = currentTest();
    container.replaceChildren();
    if (!testCase) {
      container.className = "empty-state";
      const title = document.createElement("strong");
      title.textContent = "Select a test to edit";
      const note = document.createElement("p");
      note.textContent = "Each test injects a trigger of actions, then runs ordered checks against the simulator.";
      container.append(title, note);
      return;
    }
    container.className = "";
    const heading = document.createElement("div");
    heading.className = "detail-heading";
    heading.innerHTML = "<div><h3>Scripted test</h3></div>";
    container.append(heading);
    const grid = document.createElement("div");
    grid.className = "field-grid";
    appendTextField2(grid, "Test title", testCase.id, (value) => updateTest({ id: value }));
    appendNumberField2(grid, "Points", testCase.points ?? 1, (value) => updateTest({ points: value }), { minimum: 0, integer: true });
    container.append(grid);
    container.append(renderTriggerShell(testCase));
    container.append(renderFlowShell(testCase));
    container.append(renderFeedbackShell(testCase));
  }
  function renderTriggerShell(testCase) {
    const trigger = Array.isArray(testCase.trigger) ? testCase.trigger : [];
    const body = document.createElement("div");
    body.className = "condition-editor-body";
    const list = document.createElement("div");
    list.className = "action-list";
    trigger.forEach((action, index) => {
      list.append(renderTriggerRow(action, index, trigger.length));
    });
    body.append(list);
    const add = makeButton("+ Add action", "Add trigger action", false, addTriggerAction);
    add.classList.add("btn", "btn-small", "btn-secondary", "add-sub-condition");
    body.append(add);
    return renderDisclosureSection({
      testCase,
      section: "trigger",
      title: "Trigger",
      help: "Injected actions run first, in order",
      countLabel: `${trigger.length} action${trigger.length === 1 ? "" : "s"}`,
      body
    });
  }
  function renderTriggerRow(action, index, count) {
    const row = document.createElement("div");
    row.className = "action-row";
    const collapsed = collapsedCards.has(action);
    const header = document.createElement("div");
    header.className = "action-card-header";
    const toggle = makeRowToggle(!collapsed, `action ${index + 1}`);
    const title = document.createElement("strong");
    title.className = "action-card-title";
    title.textContent = actionTitle(action);
    const summary = document.createElement("span");
    summary.className = "action-card-summary";
    summary.textContent = actionSummary(action);
    const controls = document.createElement("div");
    controls.className = "condition-order-controls";
    controls.append(
      makeButton("\u2191", "Move action up", index === 0, () => moveTriggerAction(index, -1)),
      makeButton("\u2193", "Move action down", index === count - 1, () => moveTriggerAction(index, 1)),
      makeButton("\xD7", `Remove action ${index + 1}`, false, () => removeTriggerAction(index))
    );
    header.append(toggle, title, summary, controls);
    const body = document.createElement("div");
    body.className = "action-row-body";
    body.hidden = collapsed;
    const host = document.createElement("div");
    renderActionEditor({
      container: host,
      action,
      scene: getSceneProject(),
      onChange: (nextAction) => replaceTriggerAction(index, nextAction)
    });
    body.append(host);
    bindRowToggle(toggle, body, action, `action ${index + 1}`);
    row.append(header, body);
    return row;
  }
  function renderFlowShell(testCase) {
    const steps = Array.isArray(testCase.steps) ? testCase.steps : [];
    const body = document.createElement("div");
    body.className = "condition-editor-body";
    const list = document.createElement("div");
    list.className = "step-list";
    steps.forEach((step, index) => {
      list.append(renderStepCard(step, index, steps.length));
    });
    body.append(list);
    const addRow = document.createElement("div");
    addRow.className = "step-add-row";
    const addAction = makeButton("+ Add action step", "Add action step", false, () => addStep("action"));
    addAction.classList.add("btn", "btn-small", "btn-secondary");
    const addCheck = makeButton("+ Add check step", "Add check step", false, () => addStep("check"));
    addCheck.classList.add("btn", "btn-small", "btn-secondary");
    addRow.append(addAction, addCheck);
    body.append(addRow);
    return renderDisclosureSection({
      testCase,
      section: "flow",
      title: "Test flow",
      help: "Steps run in order and stop at the first failing step",
      countLabel: `${steps.length} step${steps.length === 1 ? "" : "s"}`,
      body
    });
  }
  function renderStepCard(step, index, count) {
    const isAction = step.type === "action";
    const collapsed = collapsedCards.has(step);
    const card = document.createElement("div");
    card.className = "step-card";
    const header = document.createElement("div");
    header.className = "step-header";
    const toggle = makeRowToggle(!collapsed, `step ${index + 1}`);
    const number = document.createElement("span");
    number.className = "step-index";
    number.textContent = String(index + 1);
    const badge = document.createElement("span");
    badge.className = "step-kind-badge";
    badge.dataset.kind = isAction ? "action" : "check";
    badge.textContent = isAction ? "Do" : "Check";
    const summary = document.createElement("span");
    summary.className = "action-card-summary";
    summary.textContent = isAction ? actionSummary(step.action) : conditionSummary(step.condition);
    const controls = document.createElement("div");
    controls.className = "condition-order-controls";
    controls.append(
      makeButton("\u2191", "Move step up", index === 0, () => moveStep(index, -1)),
      makeButton("\u2193", "Move step down", index === count - 1, () => moveStep(index, 1)),
      makeButton("\xD7", `Remove step ${index + 1}`, false, () => removeStep(index))
    );
    header.append(toggle, number, badge, summary, controls);
    card.append(header);
    const body = document.createElement("div");
    body.className = "step-body";
    body.hidden = collapsed;
    renderStepBody(body, step, index);
    bindRowToggle(toggle, body, step, `step ${index + 1}`);
    card.append(body);
    return card;
  }
  function renderStepBody(body, step, index) {
    body.replaceChildren();
    const host = document.createElement("div");
    if (step.type === "action") {
      renderActionEditor({
        container: host,
        action: step.action,
        scene: getSceneProject(),
        onChange: (nextAction) => updateStep(index, { action: nextAction })
      });
      body.append(host);
      return;
    }
    renderConditionEditor({
      container: host,
      condition: step.condition,
      scene: getSceneProject(),
      allowNodeDistance: true,
      onChange: (nextCondition) => updateStep(index, { condition: nextCondition })
    });
    body.append(host, renderTimeoutField(step, index));
  }
  function renderTimeoutField(step, index) {
    const timeout = document.createElement("div");
    timeout.className = "step-timeout";
    const field = makeField3("Timeout (ms)");
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "any";
    input.value = String(Number.isFinite(step.timeout_ms) ? step.timeout_ms : DEFAULT_TIMEOUT_MS);
    input.addEventListener("change", () => {
      if (input.value === "") {
        input.value = String(DEFAULT_TIMEOUT_MS);
        updateStep(index, { timeout_ms: DEFAULT_TIMEOUT_MS });
        return;
      }
      updateStep(index, { timeout_ms: Number(input.value) });
    });
    const help = document.createElement("small");
    help.className = "field-help";
    help.textContent = "0 checks the current evidence once.";
    field.append(input, help);
    timeout.append(field);
    return timeout;
  }
  function renderFeedbackShell(testCase) {
    const shell = document.createElement("section");
    shell.className = "condition-editor-shell";
    const title = document.createElement("div");
    title.className = "condition-editor-title";
    title.innerHTML = "<strong>Feedback</strong><small>Shown to the learner with the graded result</small>";
    const fenceHelp = document.createElement("p");
    fenceHelp.className = "field-help";
    fenceHelp.textContent = LED_FENCE_HELP2;
    const grid = document.createElement("div");
    grid.className = "field-grid";
    appendTextField2(
      grid,
      "Feedback on pass",
      testCase.feedback_on_pass ?? "",
      (value) => updateTest({ feedback_on_pass: value }),
      true,
      true
    );
    appendTextField2(
      grid,
      "Feedback on fail",
      testCase.feedback_on_fail ?? "",
      (value) => updateTest({ feedback_on_fail: value }),
      true,
      true
    );
    shell.append(title, fenceHelp, grid);
    return shell;
  }
  function renderDisclosureSection({ testCase, section, title, help, countLabel, body }) {
    const shell = document.createElement("details");
    shell.className = "condition-editor-shell";
    shell.open = readSectionState2(sectionOpenState2, testCase, section);
    const summary = document.createElement("summary");
    summary.className = "condition-editor-title";
    const heading = document.createElement("strong");
    heading.textContent = title;
    const note = document.createElement("small");
    note.textContent = help;
    const count = document.createElement("span");
    count.className = "condition-editor-count";
    count.textContent = countLabel;
    summary.append(heading, note, count);
    shell.append(summary, body);
    shell.addEventListener("toggle", () => {
      writeSectionState(sectionOpenState2, testCase, section, shell.open);
    });
    return shell;
  }
  function readSectionState2(map, key, section) {
    const state2 = map.get(key);
    if (!state2 || typeof state2[section] !== "boolean") return true;
    return state2[section];
  }
  function writeSectionState(map, key, section, open) {
    let state2 = map.get(key);
    if (!state2) {
      state2 = {};
      map.set(key, state2);
    }
    state2[section] = open;
  }
  function transferSectionState2(map, previous, next) {
    if (!previous || !next) return;
    const state2 = map.get(previous);
    if (state2) map.set(next, state2);
  }
  function makeRowToggle(expanded, noun) {
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "row-toggle";
    toggle.textContent = "\u25B8";
    toggle.setAttribute("aria-expanded", String(expanded));
    toggle.setAttribute("aria-label", `${expanded ? "Collapse" : "Expand"} ${noun}`);
    return toggle;
  }
  function bindRowToggle(toggle, body, key, noun) {
    toggle.addEventListener("click", () => {
      const collapsed = !collapsedCards.has(key);
      if (collapsed) collapsedCards.add(key);
      else collapsedCards.delete(key);
      body.hidden = collapsed;
      toggle.setAttribute("aria-expanded", String(!collapsed));
      toggle.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${noun}`);
    });
  }
  function transferCollapsed(previous, next) {
    if (collapsedCards.has(previous)) collapsedCards.add(next);
  }
  function moveTest(fromIndex, targetIndex, position, restoreFocus = false) {
    const tests = getConfig().evaluation.test_cases;
    const moved = moveListItem(tests, fromIndex, targetIndex, position);
    if (!moved || !moved.changed) return;
    selectedTestIndex = getSelectionIndexAfterMove(selectedTestIndex, moved.fromIndex, moved.insertIndex);
    notifyConfigChange("tests");
    renderTestList();
    renderTestEditor();
    if (restoreFocus) focusListRow("test-list", moved.insertIndex);
  }
  function focusListRow(listId, index) {
    const button = document.getElementById(listId)?.querySelector(`.list-item[data-index="${index}"] .list-item-select`);
    if (button) button.focus();
  }
  function replaceTriggerAction(index, action) {
    const trigger = [...currentTest().trigger ?? []];
    transferCollapsed(trigger[index], action);
    trigger[index] = action;
    updateTest({ trigger });
    renderTestEditor();
  }
  function removeTriggerAction(index) {
    const testCase = currentTest();
    updateTest({ trigger: (testCase.trigger ?? []).filter((_, actionIndex) => actionIndex !== index) });
    renderTestEditor();
  }
  function moveTriggerAction(index, delta) {
    const trigger = [...currentTest().trigger ?? []];
    const target = index + delta;
    if (target < 0 || target >= trigger.length) return;
    [trigger[index], trigger[target]] = [trigger[target], trigger[index]];
    updateTest({ trigger });
    renderTestEditor();
  }
  function addTriggerAction() {
    const trigger = [...currentTest().trigger ?? [], createDefaultAction()];
    updateTest({ trigger });
    renderTestEditor();
  }
  function updateStep(index, patch) {
    const steps = [...currentTest().steps ?? []];
    const previous = steps[index];
    const next = { ...previous, ...patch };
    transferCollapsed(previous, next);
    steps[index] = next;
    updateTest({ steps });
    refreshStepCard(index, previous, next);
  }
  function refreshStepCard(index, previous, next) {
    const card = document.querySelectorAll("#test-editor-content .step-card")[index];
    if (!card) return;
    const summary = card.querySelector(".action-card-summary");
    if (summary) summary.textContent = stepSummary(next);
    const kindChanged = previous?.type !== next.type;
    const actionTypeChanged = previous?.action?.type !== next.action?.type;
    if (!kindChanged && !actionTypeChanged) return;
    const body = card.querySelector(".step-body");
    if (body) renderStepBody(body, next, index);
  }
  function stepSummary(step) {
    return step.type === "action" ? actionSummary(step.action) : conditionSummary(step.condition);
  }
  function removeStep(index) {
    const testCase = currentTest();
    updateTest({ steps: (testCase.steps ?? []).filter((_, stepIndex) => stepIndex !== index) });
    renderTestEditor();
  }
  function moveStep(index, delta) {
    const steps = [...currentTest().steps ?? []];
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    [steps[index], steps[target]] = [steps[target], steps[index]];
    updateTest({ steps });
    renderTestEditor();
  }
  function addStep(kind) {
    const step = kind === "action" ? { type: "action", action: createDefaultAction() } : { type: "check", condition: createDefaultCondition("serial_output"), timeout_ms: DEFAULT_TIMEOUT_MS };
    const steps = [...currentTest().steps ?? [], step];
    updateTest({ steps });
    renderTestEditor();
  }
  function updateTest(patch) {
    const tests = getConfig().evaluation.test_cases;
    const previous = tests[selectedTestIndex];
    const next = { ...previous, ...patch };
    tests[selectedTestIndex] = next;
    transferSectionState2(sectionOpenState2, previous, next);
    notifyConfigChange("tests");
    renderTestList();
    updatePointsIndicator();
  }
  function updatePointsIndicator() {
    const tests = getConfig().evaluation.test_cases;
    const total = tests.reduce((sum, testCase) => sum + (Number.isInteger(testCase.points) && testCase.points >= 0 ? testCase.points : 0), 0);
    const indicator = document.getElementById("points-indicator");
    indicator.replaceChildren();
    const strong = document.createElement("strong");
    strong.textContent = `${total} point${total === 1 ? "" : "s"}`;
    const text = document.createElement("span");
    text.textContent = " available across this activity";
    indicator.append(strong, text);
  }
  function selectTest(index) {
    const restoreFocus = document.activeElement?.classList.contains("list-item-select") === true;
    selectedTestIndex = index;
    renderTestList();
    renderTestEditor();
    if (restoreFocus) focusListRow("test-list", index);
  }
  function clampSelection2(tests) {
    if (tests.length === 0) selectedTestIndex = -1;
    else if (selectedTestIndex < 0 || selectedTestIndex >= tests.length) selectedTestIndex = 0;
  }
  function makeUniqueId2(tests) {
    const existing = new Set(tests.map((testCase) => testCase.id));
    let serial = tests.length + 1;
    while (existing.has(`test-${serial}`)) serial += 1;
    return `test-${serial}`;
  }
  function appendTextField2(parent, labelText, value, onChange, wide = false, textarea = false) {
    const field = makeField3(labelText, wide);
    const input = document.createElement(textarea ? "textarea" : "input");
    if (!textarea) input.type = "text";
    input.value = value ?? "";
    input.addEventListener("change", () => onChange(input.value));
    field.append(input);
    parent.append(field);
  }
  function appendNumberField2(parent, labelText, value, onChange, { minimum, integer = false } = {}) {
    const field = makeField3(labelText);
    const input = document.createElement("input");
    input.type = "number";
    input.min = String(minimum);
    input.step = integer ? "1" : "any";
    input.value = value ?? "";
    input.addEventListener("change", () => onChange(input.value === "" ? Number.NaN : Number(input.value)));
    field.append(input);
    parent.append(field);
  }
  function makeField3(labelText, wide = false) {
    const field = document.createElement("div");
    field.className = wide ? "field field--wide" : "field";
    const label = document.createElement("label");
    label.textContent = labelText;
    field.append(label);
    return field;
  }

  // src/shared/led-display.js
  function parseLedLayout(layout) {
    if (typeof layout !== "string") return null;
    const rows = layout.split("\n");
    if (rows.length !== 5) return null;
    const pixels = [];
    for (const rawRow of rows) {
      const row = rawRow.trim();
      if (row.length !== 5) return null;
      for (const character of row) {
        if (character === "." || character === "0") {
          pixels.push(0);
        } else if (character === "#") {
          pixels.push(9);
        } else if (character >= "1" && character <= "9") {
          pixels.push(character.charCodeAt(0) - 48);
        } else {
          return null;
        }
      }
    }
    return pixels;
  }

  // src/shared/effect-evaluator.js
  var textDecoder = new TextDecoder("utf-8");
  function createGrader() {
    let eventLog = [];
    let latestSensors = /* @__PURE__ */ new Map();
    let latestDisplays = /* @__PURE__ */ new Map();
    let recentButtons = /* @__PURE__ */ new Map();
    function reset() {
      eventLog = [];
      latestSensors = /* @__PURE__ */ new Map();
      latestDisplays = /* @__PURE__ */ new Map();
      recentButtons = /* @__PURE__ */ new Map();
    }
    function record(message) {
      const entry = normalizeEvent(message);
      if (!entry) return false;
      if (entry.event.kind === "code-load") reset();
      if (entry.event.kind === "button") {
        const key = `${entry.event.device_id}\0${entry.event.button}\0${entry.event.pressed}`;
        const previous = recentButtons.get(key);
        const elapsed = previous === void 0 ? Infinity : entry.ts - previous;
        if (elapsed >= 0 && elapsed < 150) return false;
        recentButtons.set(key, entry.ts);
      }
      eventLog.push(entry);
      if (entry.event.kind === "sensor") {
        const key = `${entry.event.device_id}\0${entry.event.sensor}`;
        latestSensors.set(key, {
          device_id: entry.event.device_id,
          sensor: entry.event.sensor,
          value: entry.event.value,
          ts: entry.ts
        });
      }
      if (entry.event.kind === "display") {
        latestDisplays.set(entry.event.device_id, {
          device_id: entry.event.device_id,
          pixels: Array.isArray(entry.event.pixels) ? entry.event.pixels : [],
          ts: entry.ts
        });
      }
      return true;
    }
    function evaluate(condition, now = Date.now()) {
      return evaluateConditionState(condition, eventLog, latestSensors, latestDisplays, now, -Infinity);
    }
    return { record, evaluate, reset };
  }
  function evaluateCondition(condition, events, now = Date.now(), { since = -Infinity, until = Infinity, nodePositions } = {}) {
    const eventLog = [];
    const latestSensors = /* @__PURE__ */ new Map();
    const latestDisplays = /* @__PURE__ */ new Map();
    for (const message of events ?? []) {
      const entry = normalizeEvent(message);
      if (!entry) continue;
      if (entry.ts > until) continue;
      eventLog.push(entry);
      if (entry.event.kind === "sensor") {
        latestSensors.set(`${entry.event.device_id}\0${entry.event.sensor}`, {
          device_id: entry.event.device_id,
          sensor: entry.event.sensor,
          value: entry.event.value,
          ts: entry.ts
        });
      }
      if (entry.event.kind === "display") {
        latestDisplays.set(entry.event.device_id, {
          device_id: entry.event.device_id,
          pixels: Array.isArray(entry.event.pixels) ? entry.event.pixels : [],
          ts: entry.ts
        });
      }
    }
    return evaluateConditionState(
      condition,
      eventLog,
      latestSensors,
      latestDisplays,
      now,
      since,
      nodePositions
    );
  }
  function evaluateConditionState(condition, eventLog, latestSensors, latestDisplays, now, since, nodePositions) {
    if (!condition || typeof condition !== "object") return { passed: false, matchCount: 0 };
    if (condition.type === "all" || condition.type === "any" || condition.type === "none") {
      const children = Array.isArray(condition.conditions) ? condition.conditions : [];
      const results = children.map(
        (child) => evaluateConditionState(
          child,
          eventLog,
          latestSensors,
          latestDisplays,
          now,
          since,
          nodePositions
        )
      );
      const missingNode = results.find((result2) => result2.missingNode)?.missingNode;
      if (condition.type === "all") {
        const passed2 = results.length > 0 && results.every((result2) => result2.passed);
        return withMissingNode({ passed: passed2, matchCount: passed2 ? Math.min(...results.map((result2) => result2.matchCount)) : 0 }, missingNode);
      }
      if (condition.type === "any") {
        const passing = results.filter((result2) => result2.passed);
        return withMissingNode({
          passed: passing.length > 0,
          matchCount: passing.reduce((total, result2) => total + result2.matchCount, 0)
        }, missingNode);
      }
      const passed = results.every((result2) => !result2.passed);
      return withMissingNode({
        passed,
        matchCount: passed ? 0 : results.reduce((total, result2) => total + result2.matchCount, 0)
      }, missingNode);
    }
    if (condition.type === "node_distance") {
      return evaluateNodeDistance(condition, nodePositions);
    }
    if (condition.type === "sensor_reading") {
      return evaluateSensorCondition(condition, latestSensors, now);
    }
    if (condition.type === "led_display") {
      return evaluateDisplayCondition(condition, latestDisplays);
    }
    let matchCount = 0;
    for (const entry of eventLog) {
      if (entry.ts < since) continue;
      if (matchesEventCondition(condition, entry.event)) matchCount += 1;
    }
    return {
      passed: matchCount >= (condition.min_count ?? 1),
      matchCount
    };
  }
  function withMissingNode(result2, missingNode) {
    return missingNode ? { ...result2, missingNode } : result2;
  }
  function evaluateNodeDistance(condition, nodePositions) {
    const first = lookupNodePosition(nodePositions, condition.node_a);
    const second = lookupNodePosition(nodePositions, condition.node_b);
    const missing = missingNodeRef(condition.node_a, first) ?? missingNodeRef(condition.node_b, second);
    if (missing) return { passed: false, matchCount: 0, missingNode: missing };
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    if (!Number.isFinite(distance)) return { passed: false, matchCount: 0 };
    if (condition.min != null && distance < condition.min) return { passed: false, matchCount: 0 };
    if (condition.max != null && distance > condition.max) return { passed: false, matchCount: 0 };
    return { passed: true, matchCount: 1 };
  }
  function missingNodeRef(ref, position) {
    if (!ref || typeof ref !== "object") return void 0;
    if (position) return void 0;
    const kind = ref.kind === "device" ? "device" : "source";
    return { kind, id: String(ref.id ?? "") };
  }
  function lookupNodePosition(nodePositions, ref) {
    if (!nodePositions || !ref || typeof ref !== "object") return void 0;
    const positions = ref.kind === "device" ? nodePositions.device : nodePositions.source;
    if (!(positions instanceof Map)) return void 0;
    const position = positions.get(ref.id);
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return void 0;
    return position;
  }
  function matchesEventCondition(condition, event) {
    if (!matchesDevice(condition.device_id, event.device_id)) return false;
    switch (condition.type) {
      case "serial_output":
        return event.kind === "serial" && matchText(
          event.text,
          condition.match,
          condition.value,
          condition.case_sensitive ?? true
        );
      case "button_press":
        return event.kind === "button" && event.pressed === true && (condition.button == null || condition.button === "any" || condition.button === event.button);
      case "radio_tx":
        return event.kind === "radio-tx" && matchesRadioPacket(condition, event.packet);
      case "radio_rx":
        return event.kind === "radio-rx" && (condition.from_device_id == null || event.from_device_id === condition.from_device_id) && matchesRadioPacket(condition, event.packet) && (condition.rssi_min == null || Number.isFinite(event.rssi) && event.rssi >= condition.rssi_min) && (condition.rssi_max == null || Number.isFinite(event.rssi) && event.rssi <= condition.rssi_max);
      default:
        return false;
    }
  }
  function matchesRadioPacket(condition, packet) {
    if (!packet) return false;
    if (condition.channel != null && packet.channel !== condition.channel) return false;
    if (condition.group != null && packet.group !== condition.group) return false;
    return condition.payload == null || matchesPayload(packet.data_b64, condition.payload);
  }
  function matchesPayload(dataBase64, payloadCondition) {
    const bytes = decodeBase64(dataBase64);
    if (!bytes) return false;
    if (payloadCondition.match === "hex") {
      return bytesToHex(bytes) === payloadCondition.value.toLowerCase();
    }
    let text;
    try {
      text = textDecoder.decode(stripMicroPythonStringTag(bytes));
    } catch {
      return false;
    }
    return matchText(
      text,
      payloadCondition.match,
      payloadCondition.value,
      payloadCondition.case_sensitive ?? true
    );
  }
  function stripMicroPythonStringTag(bytes) {
    if (bytes[0] !== 1 || bytes[1] !== 0 || bytes[2] !== 1) {
      return bytes;
    }
    return bytes.subarray(3);
  }
  function matchText(actual, mode, expected, caseSensitive) {
    if (typeof actual !== "string" || typeof expected !== "string") return false;
    const left = caseSensitive ? actual : actual.toLowerCase();
    const right = caseSensitive ? expected : expected.toLowerCase();
    if (mode === "contains") return left.includes(right);
    if (mode === "exact") return left === right;
    if (mode === "regex") {
      try {
        return new RegExp(expected, caseSensitive ? "" : "i").test(actual);
      } catch {
        return false;
      }
    }
    return false;
  }
  function evaluateSensorCondition(condition, latestSensors, now) {
    const durationMs = (condition.min_duration_seconds ?? 0) * 1e3;
    let matchCount = 0;
    for (const latest of latestSensors.values()) {
      if (latest.sensor !== condition.sensor || !matchesDevice(condition.device_id, latest.device_id)) continue;
      if (!Number.isFinite(latest.value)) continue;
      if (condition.min != null && latest.value < condition.min) continue;
      if (condition.max != null && latest.value > condition.max) continue;
      if (Math.max(0, now - latest.ts) < durationMs) continue;
      matchCount += 1;
    }
    return { passed: matchCount > 0, matchCount };
  }
  function evaluateDisplayCondition(condition, latestDisplays) {
    const layout = parseLedLayout(condition.layout);
    if (!layout) return { passed: false, matchCount: 0 };
    let matchCount = 0;
    for (const latest of latestDisplays.values()) {
      if (!matchesDevice(condition.device_id, latest.device_id)) continue;
      if (!matchesLedLayout(layout, latest.pixels)) continue;
      matchCount += 1;
    }
    return { passed: matchCount > 0, matchCount };
  }
  function matchesLedLayout(layout, pixels) {
    if (!Array.isArray(pixels) || pixels.length !== 25) return false;
    for (let index = 0; index < 25; index += 1) {
      const layoutLit = layout[index] > 0;
      const pixelLit = pixels[index] > 0;
      if (layoutLit !== pixelLit) return false;
    }
    return true;
  }
  function matchesDevice(conditionDeviceId, eventDeviceId) {
    return conditionDeviceId == null ? typeof eventDeviceId === "string" : conditionDeviceId === eventDeviceId;
  }
  function normalizeEvent(message) {
    if (!message || typeof message !== "object") return void 0;
    const event = message.event && typeof message.event === "object" ? message.event : message;
    if (typeof event.kind !== "string") return void 0;
    const timestamp = Number.isFinite(message.ts) ? message.ts : Number.isFinite(event.ts) ? event.ts : Date.now();
    return {
      event,
      ts: timestamp,
      ...Number.isFinite(message.seq) ? { seq: message.seq } : {}
    };
  }
  function decodeBase64(value) {
    if (typeof value !== "string") return void 0;
    try {
      const binary = atob(value);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      return bytes;
    } catch {
      return void 0;
    }
  }
  function bytesToHex(bytes) {
    let hex = "";
    for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
    return hex;
  }

  // src/shared/test-runner.js
  var CHECK_POLL_MS = 200;
  var DEFAULT_CHECK_TIMEOUT_MS2 = 5e3;
  var INSTANT_SAMPLE_TIMEOUT_MS = 250;
  var ACTION_TIMEOUT_MS = 5e3;
  var textEncoder = new TextEncoder();
  function createTestRunner({
    testCases = [],
    bridge: bridge3,
    onEvent = () => {
    },
    sleep,
    now,
    /**
     * Awaited before every test case, including the first. The host resets the
     * simulator scene and waits for the programs to run again, so one test case
     * cannot inherit another's state. Failures are reported per test case.
     */
    isolate
  } = {}) {
    if (!bridge3 || typeof bridge3 !== "object") {
      throw new TypeError("createTestRunner requires a bridge");
    }
    const sleepFn = typeof sleep === "function" ? sleep : (ms) => new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
    const nowFn = typeof now === "function" ? now : () => Date.now();
    let cancelled = false;
    let displayWarningEmitted = false;
    let activeRun = null;
    function cancelledResult(testCase) {
      return {
        id: testCase.id,
        passed: false,
        failedStepIndex: null,
        detail: "cancelled",
        points: normalizePoints(testCase.points)
      };
    }
    function isStale(run) {
      return cancelled || run !== activeRun;
    }
    function encodeUtf8Base64(text) {
      return bytesToBase64(textEncoder.encode(String(text ?? "")));
    }
    async function executeAction(action, run) {
      if (!action || typeof action !== "object") return;
      const count = Number.isFinite(action.count) ? Math.max(1, Math.trunc(action.count)) : 1;
      const intervalMs = Number.isFinite(action.interval_ms) ? Math.max(0, action.interval_ms) : 0;
      const options = { timeoutMs: ACTION_TIMEOUT_MS, signal: run.signal };
      for (let fire = 0; fire < count; fire += 1) {
        if (isStale(run)) return;
        switch (action.type) {
          case "radio_broadcast":
            await bridge3.radioBroadcast({
              device_id: action.device_id ?? null,
              payload_b64: encodeUtf8Base64(action.payload ?? ""),
              channel: action.channel ?? null,
              group: action.group ?? null
            }, options);
            break;
          case "press_button":
            await bridge3.pressButton({
              device_id: action.device_id ?? null,
              button: action.button ?? "A"
            }, options);
            break;
          case "set_node_level":
            await bridge3.setNodeLevel({
              node_id: action.node_id ?? null,
              value: action.value ?? 0
            }, options);
            break;
          case "move_node":
            await bridge3.moveNode({
              node_id: action.node_id ?? null,
              x: action.x,
              y: action.y
            }, options);
            break;
          case "add_node":
            await bridge3.addNode({
              node_type: action.node_type,
              x: action.x,
              y: action.y,
              level: action.level ?? null,
              duration_seconds: action.duration_seconds ?? 10
            }, options);
            break;
          default:
            break;
        }
        if (fire < count - 1 && intervalMs > 0 && !isStale(run)) await sleepFn(intervalMs);
      }
    }
    function warnDisplayPollingFailure() {
      if (displayWarningEmitted) return;
      displayWarningEmitted = true;
      onEvent({ kind: "runner-warning", message: "Display polling failed; treating displays as empty." });
    }
    async function readDisplays(options) {
      try {
        const displays = await bridge3.getDisplay(options);
        return displays && typeof displays === "object" ? displays : {};
      } catch {
        if (!options.signal?.aborted) warnDisplayPollingFailure();
        return void 0;
      }
    }
    async function readNodePositions(nodeRefs, options) {
      if (nodeRefs.length === 0) return void 0;
      try {
        const positions = await bridge3.getNodePositions(nodeRefs, options);
        return toPositionMaps(positions);
      } catch {
        return void 0;
      }
    }
    function appendDisplayEvents(feed, displays, previous) {
      const updated = {};
      for (const [deviceId, pixels] of Object.entries(displays)) {
        if (!Array.isArray(pixels)) continue;
        updated[deviceId] = [...pixels];
        if (previous) {
          const before = previous[deviceId];
          if (before && framesEqual(before, pixels)) continue;
        }
        feed.push({
          ts: nowFn(),
          event: { kind: "display", device_id: deviceId, pixels: [...pixels] }
        });
      }
      return updated;
    }
    function evaluateStep(step, feed, since, until, nowValue, nodePositions) {
      return evaluateCondition(step?.condition, feed, nowValue, { since, until, nodePositions });
    }
    function missingNodeDetail(stepIndex, evaluation) {
      const { kind, id } = evaluation.missingNode;
      return `Step ${stepIndex + 1} cannot check distance: unknown ${kind} ${id}.`;
    }
    async function runCheckStep(step, feed, since, stepIndex, run) {
      const timeoutMs = checkTimeoutMs(step);
      const startedAt = nowFn();
      const deadline = startedAt + timeoutMs;
      const needsDisplay = conditionNeedsDisplay(step?.condition);
      const needsPositions = conditionNeedsPositions(step?.condition);
      const nodeRefs = needsPositions ? collectNodeRefs(step.condition) : [];
      const needsState = needsDisplay || needsPositions;
      let previousDisplays = null;
      let nodePositions;
      if (timeoutMs === 0) {
        if (needsState) {
          const options = { timeoutMs: INSTANT_SAMPLE_TIMEOUT_MS, signal: run.signal };
          const [sampledDisplays, sampledPositions] = await Promise.all([
            needsDisplay ? readDisplays(options) : void 0,
            needsPositions ? readNodePositions(nodeRefs, options) : void 0
          ]);
          if (isStale(run)) return { cancelled: true };
          nodePositions = sampledPositions;
          if (sampledDisplays) {
            previousDisplays = appendDisplayEvents(feed, sampledDisplays, previousDisplays);
            backdateDisplayEvents(feed, previousDisplays, startedAt);
          }
        }
        const evaluation = evaluateStep(step, feed, since, startedAt, startedAt, nodePositions);
        if (evaluation.missingNode && nodePositions) {
          return { passed: false, detail: missingNodeDetail(stepIndex, evaluation) };
        }
        return { passed: evaluation.passed };
      }
      const pollCeiling = needsState ? Math.min(CHECK_POLL_MS, Math.max(1, Math.floor(timeoutMs / 4))) : CHECK_POLL_MS;
      while (true) {
        if (isStale(run)) return { cancelled: true };
        const remaining = deadline - nowFn();
        if (remaining <= 0) break;
        if (needsState) {
          const options = { timeoutMs: remaining, signal: run.signal };
          const [sampledDisplays, sampledPositions] = await Promise.all([
            needsDisplay ? readDisplays(options) : void 0,
            needsPositions ? readNodePositions(nodeRefs, options) : void 0
          ]);
          if (isStale(run)) return { cancelled: true };
          const inBudget = nowFn() <= deadline;
          if (inBudget && sampledDisplays) {
            previousDisplays = appendDisplayEvents(feed, sampledDisplays, previousDisplays);
          }
          if (inBudget && sampledPositions) nodePositions = sampledPositions;
        }
        const evaluation = evaluateStep(
          step,
          feed,
          since,
          deadline,
          Math.min(nowFn(), deadline),
          nodePositions
        );
        if (evaluation.missingNode && nodePositions) {
          return { passed: false, detail: missingNodeDetail(stepIndex, evaluation) };
        }
        if (evaluation.passed) return { passed: true };
        const budget = deadline - nowFn();
        if (budget <= 0) break;
        await sleepFn(Math.min(pollCeiling, budget));
      }
      if (isStale(run)) return { cancelled: true };
      const finalEvaluation = evaluateStep(
        step,
        feed,
        since,
        deadline,
        Math.min(nowFn(), deadline),
        nodePositions
      );
      if (finalEvaluation.missingNode && nodePositions) {
        return { passed: false, detail: missingNodeDetail(stepIndex, finalEvaluation) };
      }
      return { passed: finalEvaluation.passed };
    }
    async function runTest(testCase, feed, run, sinceOverride) {
      const points = normalizePoints(testCase.points);
      const result2 = (passed, failedStepIndex, detail) => ({
        id: testCase.id,
        passed,
        failedStepIndex,
        detail,
        points
      });
      const steps = Array.isArray(testCase.steps) ? testCase.steps : [];
      const trigger = Array.isArray(testCase.trigger) ? testCase.trigger : [];
      let since = Number.isFinite(sinceOverride) ? sinceOverride : nowFn();
      for (let actionIndex = 0; actionIndex < trigger.length; actionIndex += 1) {
        if (isStale(run)) return result2(false, null, "cancelled");
        try {
          await executeAction(trigger[actionIndex], run);
        } catch (error) {
          if (isStale(run)) return result2(false, null, "cancelled");
          return result2(false, null, `Trigger action ${actionIndex + 1} failed: ${errorMessage(error)}`);
        }
      }
      if (isStale(run)) return result2(false, null, "cancelled");
      for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
        const step = steps[stepIndex];
        if (isStale(run)) return result2(false, null, "cancelled");
        if (step?.type === "action") {
          since = nowFn();
          try {
            await executeAction(step.action, run);
          } catch (error) {
            if (isStale(run)) return result2(false, null, "cancelled");
            return result2(false, stepIndex, `Step ${stepIndex + 1} action failed: ${errorMessage(error)}`);
          }
          continue;
        }
        const outcome = await runCheckStep(step, feed, since, stepIndex, run);
        if (outcome.cancelled) return result2(false, null, "cancelled");
        if (!outcome.passed) {
          if (outcome.detail) return result2(false, stepIndex, outcome.detail);
          return result2(false, stepIndex, checkTimeoutMs(step) > 0 ? "Test timed out." : "Condition not met.");
        }
        since = nowFn();
      }
      return result2(true, null, "passed");
    }
    async function runAll({ onProgress = () => {
    } } = {}) {
      cancelled = false;
      displayWarningEmitted = false;
      const controller = new AbortController();
      const run = { controller, signal: controller.signal };
      activeRun = run;
      const feed = [];
      const results = [];
      let earnedPoints = 0;
      const total = testCases.length;
      const unsubscribe = typeof bridge3.onEvent === "function" ? bridge3.onEvent((payload) => {
        if (!payload || typeof payload !== "object") return;
        feed.push({
          ts: Number.isFinite(payload.ts) ? payload.ts : nowFn(),
          event: payload.event
        });
        onEvent(payload);
      }) : null;
      try {
        for (let index = 0; index < total; index += 1) {
          const testCase = testCases[index];
          if (isStale(run)) {
            onProgress({ id: testCase.id, index, total, status: "cancelled" });
            continue;
          }
          onProgress({ id: testCase.id, index, total, status: "running" });
          let setupFailure;
          let windowStart;
          if (typeof isolate === "function") {
            windowStart = nowFn();
            try {
              await isolate({ testCase, index, total, signal: run.signal });
            } catch (error) {
              if (!isStale(run)) setupFailure = errorMessage(error);
            }
          }
          if (isStale(run)) {
            onProgress({ id: testCase.id, index, total, status: "cancelled" });
            continue;
          }
          if (setupFailure !== void 0) {
            results.push({
              id: testCase.id,
              passed: false,
              failedStepIndex: null,
              detail: `Setup failed: ${setupFailure}`,
              points: normalizePoints(testCase.points)
            });
            onProgress({ id: testCase.id, index, total, status: "failed" });
            continue;
          }
          const result2 = await runTest(testCase, feed, run, windowStart);
          if (isStale(run) || result2.detail === "cancelled") {
            if (run === activeRun) onProgress({ id: testCase.id, index, total, status: "cancelled" });
            continue;
          }
          results.push(result2);
          if (result2.passed) earnedPoints += result2.points;
          if (run === activeRun) {
            onProgress({
              id: testCase.id,
              index,
              total,
              status: result2.passed ? "passed" : "failed"
            });
          }
        }
      } finally {
        if (unsubscribe) unsubscribe();
        if (activeRun === run) activeRun = null;
      }
      if (cancelled) {
        return {
          results: testCases.map(cancelledResult),
          earnedPoints: 0,
          totalPoints: testCases.reduce((sum, testCase) => sum + normalizePoints(testCase.points), 0)
        };
      }
      const totalPoints = testCases.reduce((sum, testCase) => sum + normalizePoints(testCase.points), 0);
      return {
        results,
        earnedPoints,
        totalPoints,
        score: totalPoints > 0 ? Math.round(earnedPoints / totalPoints * 100) : 0
      };
    }
    function cancel() {
      cancelled = true;
      activeRun?.controller.abort();
    }
    return { runAll, cancel };
  }
  function checkTimeoutMs(step) {
    return Number.isFinite(step?.timeout_ms) ? Math.max(0, step.timeout_ms) : DEFAULT_CHECK_TIMEOUT_MS2;
  }
  function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
  }
  function conditionNeedsDisplay(condition) {
    if (!condition || typeof condition !== "object") return false;
    if (condition.type === "led_display") return true;
    return Array.isArray(condition.conditions) && condition.conditions.some(conditionNeedsDisplay);
  }
  function conditionNeedsPositions(condition) {
    if (!condition || typeof condition !== "object") return false;
    if (condition.type === "node_distance") return true;
    return Array.isArray(condition.conditions) && condition.conditions.some(conditionNeedsPositions);
  }
  function collectNodeRefs(condition, refs = [], seen = /* @__PURE__ */ new Set()) {
    if (!condition || typeof condition !== "object") return refs;
    if (condition.type === "node_distance") {
      for (const ref of [condition.node_a, condition.node_b]) {
        if (!ref || typeof ref !== "object" || typeof ref.id !== "string") continue;
        const kind = ref.kind === "device" ? "device" : "source";
        const key = `${kind}\0${ref.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        refs.push({ kind, id: ref.id });
      }
    }
    if (Array.isArray(condition.conditions)) {
      for (const child of condition.conditions) collectNodeRefs(child, refs, seen);
    }
    return refs;
  }
  function toPositionMaps(positions) {
    const device = /* @__PURE__ */ new Map();
    const source = /* @__PURE__ */ new Map();
    for (const position of Array.isArray(positions) ? positions : []) {
      if (!position || typeof position !== "object") continue;
      if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) continue;
      const target = position.kind === "device" ? device : position.kind === "source" ? source : null;
      if (!target) continue;
      target.set(position.id, { x: position.x, y: position.y });
    }
    return { device, source };
  }
  function backdateDisplayEvents(feed, displays, startedAt) {
    const deviceIds = new Set(Object.keys(displays ?? {}));
    for (let index = feed.length - 1; index >= 0; index -= 1) {
      const entry = feed[index];
      if (entry.event?.kind !== "display" || !deviceIds.has(entry.event.device_id)) continue;
      if (entry.ts > startedAt) entry.ts = startedAt;
    }
  }
  function normalizePoints(points) {
    return Number.isFinite(points) && points >= 0 ? points : 1;
  }
  function framesEqual(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (let index = 0; index < left.length; index += 1) {
      if (left[index] !== right[index]) return false;
    }
    return true;
  }

  // src/shared/hint-evaluator.js
  function createHintState() {
    return {
      consumed: /* @__PURE__ */ new Set(),
      firstTriggered: /* @__PURE__ */ new Map(),
      triggered: /* @__PURE__ */ new Set(),
      attemptCount: 0
    };
  }
  function recordCheckAttempt(state2) {
    state2.attemptCount += 1;
    return state2.attemptCount;
  }
  function consumeHint(state2, hintId) {
    state2.consumed.add(hintId);
  }
  function evaluateHints(hints, state2, event, evaluateCondition2, { now = Date.now() } = {}) {
    const visibleHints = [];
    let nextEvaluationDelayMs = null;
    for (let index = 0; index < (hints?.length ?? 0); index += 1) {
      const hint = hints[index];
      if (!hint?.trigger || !hint.id) continue;
      const displayMode = hint.display_mode ?? "triggered";
      const consumed = state2.consumed.has(hint.id);
      if (consumed && displayMode !== "checklist") continue;
      const trigger = hint.trigger;
      const delay = hint.delay_seconds ?? 0;
      const delayStarted = state2.firstTriggered.has(hint.id);
      const isMatchingEvent = event?.type === trigger.event && (trigger.event !== "test_fail" || (event.failedCheckCount ?? 0) > 0) && (event.hint_id === void 0 || event.hint_id === hint.id);
      const isDelayTick = event?.type === "timer" && delayStarted;
      const isInvalidationCheck = trigger.invalidate_on_condition_false === true && state2.triggered.has(hint.id) && event?.type === "sim_event";
      const isPendingDelayCheck = delayStarted && event?.type !== "timer";
      if (!isMatchingEvent && !isDelayTick && !isInvalidationCheck && !isPendingDelayCheck) continue;
      if ((trigger.after_attempts ?? 0) > state2.attemptCount) continue;
      let conditionPassed = true;
      if (trigger.conditions !== void 0) {
        const conditionResult = evaluateCondition2(trigger.conditions);
        conditionPassed = typeof conditionResult === "boolean" ? conditionResult : conditionResult?.passed === true;
      }
      if (!conditionPassed) {
        state2.firstTriggered.delete(hint.id);
        if (trigger.invalidate_on_condition_false === true) {
          state2.triggered.delete(hint.id);
        }
        continue;
      }
      if (state2.triggered.has(hint.id)) {
        continue;
      }
      if (!isMatchingEvent && !isDelayTick && !isPendingDelayCheck) continue;
      if (delay > 0) {
        if (!delayStarted) {
          state2.firstTriggered.set(hint.id, now);
          nextEvaluationDelayMs = nextEvaluationDelayMs === null ? delay * 1e3 : Math.min(nextEvaluationDelayMs, delay * 1e3);
          continue;
        }
        const remainingMs = delay * 1e3 - (now - state2.firstTriggered.get(hint.id));
        if (remainingMs > 0) {
          nextEvaluationDelayMs = nextEvaluationDelayMs === null ? remainingMs : Math.min(nextEvaluationDelayMs, remainingMs);
          continue;
        }
      }
      state2.firstTriggered.delete(hint.id);
      state2.triggered.add(hint.id);
    }
    for (let index = 0; index < (hints?.length ?? 0); index += 1) {
      const hint = hints[index];
      if (!hint?.id) continue;
      const displayMode = hint.display_mode ?? "triggered";
      if (displayMode !== "checklist" && (!state2.triggered.has(hint.id) || state2.consumed.has(hint.id))) {
        continue;
      }
      visibleHints.push({
        id: hint.id,
        message: hint.message,
        priority: hint.priority ?? 1,
        display_mode: displayMode,
        style: hint.style ?? "info",
        triggered: state2.triggered.has(hint.id),
        show_once: hint.show_once === true
      });
    }
    visibleHints.sort((left, right) => right.priority - left.priority);
    return { visibleHints, nextEvaluationDelayMs };
  }
  function getManualHintRequestState(hints, state2, evaluateCondition2) {
    const manualHints = Array.isArray(hints) ? hints.filter((hint) => hint?.trigger?.event === "manual") : [];
    if (manualHints.length === 0) return { hasManualHints: false, canRequest: false };
    const canRequest = manualHints.some((hint) => {
      if (!hint?.id || state2.consumed.has(hint.id)) return false;
      if ((hint.trigger.after_attempts ?? 0) > state2.attemptCount) return false;
      if (hint.trigger.conditions === void 0) return true;
      const result2 = evaluateCondition2(hint.trigger.conditions);
      return typeof result2 === "boolean" ? result2 : result2?.passed === true;
    });
    return { hasManualHints: true, canRequest };
  }
  function createHintEventDebouncer(callback, delayMs = 250) {
    let timer;
    let pendingEvent;
    function flush() {
      if (timer !== void 0) {
        clearTimeout(timer);
        timer = void 0;
      }
      if (pendingEvent === void 0) return;
      const event = pendingEvent;
      pendingEvent = void 0;
      callback(event);
    }
    return {
      push(event) {
        if (event?.type !== "sim_event") {
          flush();
          callback(event);
          return;
        }
        pendingEvent = event;
        clearTimeout(timer);
        timer = setTimeout(flush, delayMs);
      },
      flush,
      cancel() {
        clearTimeout(timer);
        timer = void 0;
        pendingEvent = void 0;
      }
    };
  }

  // src/shared/scene-isolation.js
  var DEFAULT_LOAD_TIMEOUT_MS = 1e4;
  var DEFAULT_RESTART_TIMEOUT_MS = 15e3;
  function restoreAuthoredScene(authored, current) {
    const liveDevices = new Map(current.devices.map((device) => [device.id, device]));
    const devices = authored.devices.map((device) => {
      const live = liveDevices.get(device.id);
      if (!live) {
        return device;
      }
      const {
        programArtifactId: _authoredArtifactId,
        editableProgram: _authoredEditableProgram,
        ...geometry
      } = device;
      return {
        ...geometry,
        ...live.programArtifactId === void 0 ? {} : { programArtifactId: live.programArtifactId },
        ...live.editableProgram === void 0 ? {} : { editableProgram: live.editableProgram }
      };
    });
    const referencedArtifactIds = new Set(
      devices.map((device) => device.programArtifactId).filter((artifactId) => typeof artifactId === "string")
    );
    const artifacts = [];
    for (const artifact of [...current.artifacts, ...authored.artifacts]) {
      if (!referencedArtifactIds.has(artifact.id)) continue;
      if (artifacts.some((candidate) => candidate.id === artifact.id)) continue;
      artifacts.push(artifact);
    }
    return {
      ...current,
      devices,
      artifacts,
      environmentSources: authored.environmentSources
    };
  }
  function createSceneIsolation({
    bridge: bridge3,
    authoredBundleBase64 = null,
    loadTimeoutMs = DEFAULT_LOAD_TIMEOUT_MS,
    restartTimeoutMs = DEFAULT_RESTART_TIMEOUT_MS,
    onWarning = (message) => console.warn(message)
  } = {}) {
    if (!bridge3 || typeof bridge3 !== "object") {
      throw new TypeError("createSceneIsolation requires a bridge");
    }
    let baseline = null;
    let programmedDeviceIds = [];
    function decodeAuthored() {
      if (typeof authoredBundleBase64 !== "string" || authoredBundleBase64.length === 0) {
        return null;
      }
      try {
        return decodeSwarmBundle(base64ToBytes(authoredBundleBase64));
      } catch (error) {
        onWarning(
          `Authored scene could not be read, so positions stay at their current values: ${error instanceof Error ? error.message : String(error)}`
        );
        return null;
      }
    }
    async function prepare() {
      const bundle = await bridge3.getBundle({ timeoutMs: loadTimeoutMs });
      if (typeof bundle !== "string" || bundle.length === 0) {
        throw new Error("The simulator did not return its scene before the run.");
      }
      const current = decodeSwarmBundle(base64ToBytes(bundle));
      const authored = decodeAuthored();
      const baselineProject = authored ? restoreAuthoredScene(authored, current) : current;
      baseline = bytesToBase64(encodeSwarmBundle(baselineProject));
      programmedDeviceIds = baselineProject.devices.filter((device) => typeof device.programArtifactId === "string").map((device) => device.id);
      return { authored: Boolean(authored), deviceCount: programmedDeviceIds.length };
    }
    async function isolate({ signal } = {}) {
      if (signal?.aborted) throw abortReason(signal);
      if (baseline === null) await prepare();
      const remaining = new Set(programmedDeviceIds);
      let settle2;
      let settled = false;
      const finished = new Promise((resolve) => {
        settle2 = resolve;
      });
      const completeIfReady = () => {
        if (settled || remaining.size > 0) return;
        settled = true;
        settle2();
      };
      const unsubscribe = bridge3.onEvent((payload) => {
        const event = payload && typeof payload === "object" ? payload.event : void 0;
        if (!event || typeof event.device_id !== "string") return;
        if (event.kind !== "code-restart" && event.kind !== "code-load") return;
        if (!remaining.delete(event.device_id)) return;
        completeIfReady();
      });
      const timer = setTimeout(() => {
        settled = true;
        settle2();
      }, restartTimeoutMs);
      const onAbort = () => {
        settled = true;
        settle2();
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        await bridge3.loadBundle(baseline, {
          timeoutMs: loadTimeoutMs,
          ...signal ? { signal } : {}
        });
        completeIfReady();
        await finished;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        unsubscribe?.();
      }
      if (signal?.aborted) throw abortReason(signal);
      if (remaining.size > 0) {
        throw new Error(
          `The simulator did not restart ${[...remaining].join(", ")} within ${restartTimeoutMs} ms.`
        );
      }
    }
    return { prepare, isolate };
  }
  function abortReason(signal) {
    const reason = signal?.reason;
    return reason instanceof Error ? reason : new Error("Scene isolation cancelled.");
  }

  // src/shared/inline-markdown.js
  var LED_TOKEN_PREFIX = "\uE000LED";
  var LED_TOKEN_SUFFIX = "\uE001";
  var LED_SIZE = 80;
  var LED_GRID_START = 12;
  var LED_GRID_STEP = 14;
  var LED_RADIUS = 4;
  function renderInlineMarkdown(value) {
    const text = (value == null ? "" : String(value)).replace(/\r\n/g, "\n");
    const { text: tokenized, blocks } = extractLedBlocks(text);
    let html = renderSegment(tokenized);
    blocks.forEach((pixels, index) => {
      html = html.replace(ledToken(index), renderLedScreen(pixels));
    });
    return html;
  }
  function extractLedBlocks(text) {
    const lines = text.split("\n");
    const blocks = [];
    const output = [];
    let index = 0;
    while (index < lines.length) {
      if (!isLedFence(lines[index])) {
        output.push(lines[index]);
        index += 1;
        continue;
      }
      let cursor = index + 1;
      while (cursor < lines.length && !isClosingFence(lines[cursor])) {
        if (isLedFence(lines[cursor])) break;
        cursor += 1;
      }
      if (cursor < lines.length && isLedFence(lines[cursor])) {
        output.push(...lines.slice(index, cursor));
        index = cursor;
        continue;
      }
      if (cursor >= lines.length) {
        output.push(...lines.slice(index));
        break;
      }
      const rows = lines.slice(index + 1, cursor).map((row) => row.trim());
      const pixels = parseLedLayout(rows.join("\n"));
      if (!pixels) {
        output.push(...lines.slice(index, cursor + 1));
        index = cursor + 1;
        continue;
      }
      output.push(ledToken(blocks.length));
      blocks.push(pixels);
      index = cursor + 1;
    }
    return { text: output.join("\n"), blocks };
  }
  function isLedFence(line) {
    return line.trim() === "```led";
  }
  function isClosingFence(line) {
    return line.trim() === "```";
  }
  function ledToken(index) {
    return `${LED_TOKEN_PREFIX}${index}${LED_TOKEN_SUFFIX}`;
  }
  function renderLedScreen(pixels) {
    const values = [];
    for (let index = 0; index < 25; index += 1) {
      const brightness = pixels[index];
      values.push(Number.isInteger(brightness) && brightness >= 0 && brightness <= 9 ? brightness : 0);
    }
    const rows = [];
    for (let row = 0; row < 5; row += 1) {
      rows.push(values.slice(row * 5, row * 5 + 5).join(""));
    }
    let cells = "";
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 5; column += 1) {
        const brightness = values[row * 5 + column];
        const cx = LED_GRID_START + column * LED_GRID_STEP;
        const cy = LED_GRID_START + row * LED_GRID_STEP;
        cells += `<circle cx="${cx}" cy="${cy}" r="${LED_RADIUS}" fill="#3a2a2a" data-brightness="${brightness}"/>` + (brightness > 0 ? `<circle cx="${cx}" cy="${cy}" r="${LED_RADIUS}" fill="#ff2d2d" opacity="${(brightness / 9).toFixed(3)}"/>` : "");
      }
    }
    return `<svg class="led-screen" width="${LED_SIZE}" height="${LED_SIZE}" viewBox="0 0 ${LED_SIZE} ${LED_SIZE}" role="img" aria-label="LED display rows: ${rows.join(" / ")}"><rect width="${LED_SIZE}" height="${LED_SIZE}" rx="10" fill="#1b1b20"/>${cells}</svg>`;
  }
  function renderSegment(text) {
    let html = "";
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] === "\n") {
        html += "<br>";
        continue;
      }
      if (text[index] === "`") {
        const closingIndex = text.indexOf("`", index + 1);
        if (closingIndex > index + 1) {
          const codeContent = text.slice(index + 1, closingIndex);
          if (!codeContent.includes("\n")) {
            html += `<code>${escapeHtml(codeContent)}</code>`;
            index = closingIndex;
            continue;
          }
        }
      }
      if (text.startsWith("**", index)) {
        const closingIndex = findClosingDelimiter(text, index, "**");
        if (closingIndex !== -1) {
          html += `<strong>${renderSegment(text.slice(index + 2, closingIndex))}</strong>`;
          index = closingIndex + 1;
          continue;
        }
      }
      if (text[index] === "*") {
        const closingIndex = findClosingDelimiter(text, index, "*");
        if (closingIndex !== -1) {
          html += `<em>${renderSegment(text.slice(index + 1, closingIndex))}</em>`;
          index = closingIndex;
          continue;
        }
      }
      html += escapeHtml(text[index]);
    }
    return html;
  }
  function findClosingDelimiter(text, startIndex, delimiter) {
    let searchIndex = startIndex + delimiter.length;
    while (searchIndex < text.length) {
      const closingIndex = text.indexOf(delimiter, searchIndex);
      if (closingIndex === -1) {
        return -1;
      }
      const content = text.slice(startIndex + delimiter.length, closingIndex);
      if (content.trim()) {
        return closingIndex;
      }
      searchIndex = closingIndex + delimiter.length;
    }
    return -1;
  }
  function escapeHtml(text) {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // src/activity-builder/js/preview-tab.js
  var LEARNER_URL = "sim/index.html?mode=learner";
  var READY_TIMEOUT_MS = 1e4;
  var LOAD_TIMEOUT_MS = 1e4;
  var CHECK_LABEL = "Check";
  var RUNNING_LABEL = "Running\u2026";
  var bridge2;
  var bridgeReady2 = false;
  var connecting = false;
  var connectToken = 0;
  var runner;
  var sceneIsolation;
  var runnerToken = 0;
  var checkInProgress = false;
  var runProgress = /* @__PURE__ */ new Map();
  var seenSimulatorPayloads = /* @__PURE__ */ new WeakSet();
  var grader = createGrader();
  var hintState = createHintState();
  var latestHintResult = { visibleHints: [], nextEvaluationDelayMs: null };
  var hintTimer;
  var hintDebouncer = createHintEventDebouncer(evaluateHintEvent, 250);
  function initPreviewTab() {
    void connectPreview();
    document.getElementById("btn-reset-session").addEventListener("click", () => void resetSession());
    document.getElementById("btn-check-session").addEventListener("click", () => void checkSession());
    onConfigChange((config) => {
      invalidateRun();
      resetPreviewState();
      if (bridgeReady2 && bridge2) {
        const activeBridge = bridge2;
        void applySettings(activeBridge, config).catch(() => {
        });
        rebuildRunner();
      }
    });
    onSceneChange(() => {
      void connectPreview({ reset: true });
    });
    renderGrades(null);
    renderHints();
  }
  async function connectPreview({ reset = false } = {}) {
    const generation = ++connectToken;
    connecting = true;
    invalidateRun();
    resetPreviewState();
    const previousBridge = bridge2;
    bridge2 = void 0;
    bridgeReady2 = false;
    previousBridge?.close();
    updateControls();
    setPreviewStatus("Waiting for learner simulator\u2026");
    const frame = document.getElementById("preview-iframe");
    if (!frame) {
      connecting = false;
      updateControls();
      setPreviewStatus("Learner simulator frame is unavailable.", "error");
      return;
    }
    const freshFrame = frame.cloneNode(false);
    freshFrame.id = frame.id;
    freshFrame.src = "about:blank";
    frame.replaceWith(freshFrame);
    const targetOrigin = new URL(LEARNER_URL, window.location.href).origin;
    const frameWindow = freshFrame.contentWindow;
    if (!frameWindow) {
      connecting = false;
      updateControls();
      setPreviewStatus("Learner simulator frame is unavailable.", "error");
      return;
    }
    const bundle = getSceneBundle();
    const activeBridge = connectSimBridge(frameWindow, targetOrigin);
    bridge2 = activeBridge;
    activeBridge.onEvent((payload) => handleSimulatorEvent(payload, activeBridge));
    freshFrame.src = LEARNER_URL;
    const isStale = () => generation !== connectToken || activeBridge !== bridge2;
    const ready = await waitForReady(activeBridge, READY_TIMEOUT_MS);
    if (isStale()) return;
    if (!ready) {
      activeBridge.close();
      bridge2 = void 0;
      bridgeReady2 = false;
      connecting = false;
      rebuildRunner();
      updateControls();
      setPreviewStatus(
        reset ? "Could not reset preview: learner simulator did not answer within 10 seconds." : "Learner simulator did not connect within 10 seconds.",
        "error"
      );
      return;
    }
    bridgeReady2 = true;
    try {
      await applyPreviewSettings(activeBridge);
      if (isStale()) return;
      if (bundle) await activeBridge.loadBundle(bundle, { timeoutMs: LOAD_TIMEOUT_MS });
      if (isStale()) return;
      await applyPreviewSettings(activeBridge);
      if (isStale()) return;
      connecting = false;
      rebuildRunner();
      updateControls();
      if (reset) {
        setPreviewStatus(
          bundle ? "Preview reset to the starting scene." : "Preview reset to the built-in demo (no captured scene)."
        );
      } else {
        setPreviewStatus(
          bundle ? "Learner simulator connected." : "Showing the built-in demo. Capture a scene to preview your activity."
        );
      }
    } catch (error) {
      if (isStale()) return;
      activeBridge.close();
      bridge2 = void 0;
      bridgeReady2 = false;
      connecting = false;
      rebuildRunner();
      updateControls();
      const reason = error instanceof Error ? error.message : String(error);
      setPreviewStatus(
        reset ? `Could not reset preview: ${reason}` : `Could not connect to the learner simulator: ${reason}`,
        "error"
      );
    }
  }
  function previewUiVisibility(config) {
    return { ...config.panel_visibility, node_coordinates: true };
  }
  async function applyPreviewSettings(bridgeRef) {
    await applySettings(bridgeRef, getConfig());
  }
  async function applySettings(bridgeRef, config) {
    await bridgeRef.setCapabilities(config.capabilities);
    await bridgeRef.setUiVisibility(previewUiVisibility(config));
  }
  function waitForReady(bridgeRef, timeoutMs) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      bridgeRef.ready.then(
        (value) => {
          clearTimeout(timer);
          resolve(value === true);
        },
        () => {
          clearTimeout(timer);
          resolve(false);
        }
      );
    });
  }
  function resetPreviewState() {
    grader.reset();
    hintState = createHintState();
    latestHintResult = { visibleHints: [], nextEvaluationDelayMs: null };
    runProgress = /* @__PURE__ */ new Map();
    hintDebouncer.cancel();
    clearTimeout(hintTimer);
    hintTimer = void 0;
    renderGrades(null);
    evaluateHintEvent({ type: "timer" });
  }
  function invalidateRun() {
    runnerToken += 1;
    const previousRunner = runner;
    runner = void 0;
    sceneIsolation = void 0;
    if (previousRunner) previousRunner.cancel();
    runProgress = /* @__PURE__ */ new Map();
    checkInProgress = false;
    updateControls();
  }
  function updateControls() {
    const resetButton = document.getElementById("btn-reset-session");
    if (resetButton) resetButton.disabled = connecting;
    const checkButton = document.getElementById("btn-check-session");
    if (!checkButton) return;
    checkButton.textContent = checkInProgress ? RUNNING_LABEL : CHECK_LABEL;
    checkButton.disabled = checkInProgress || connecting || !bridgeReady2 || !runner;
  }
  function rebuildRunner() {
    const previousRunner = runner;
    runnerToken += 1;
    runner = void 0;
    if (previousRunner) previousRunner.cancel();
    if (bridgeReady2 && bridge2) {
      const activeBridge = bridge2;
      sceneIsolation = createSceneIsolation({
        bridge: activeBridge,
        authoredBundleBase64: getSceneBundle(),
        onWarning: (message) => showToast(message, "error")
      });
      runner = createTestRunner({
        testCases: getConfig().evaluation.test_cases,
        bridge: activeBridge,
        isolate: sceneIsolation.isolate,
        onEvent: (payload) => {
          if (activeBridge !== bridge2) return;
          handleSimulatorEvent(payload, activeBridge);
        }
      });
    }
    updateControls();
  }
  function handleSimulatorEvent(payload, sourceBridge = bridge2) {
    if (sourceBridge !== bridge2) return;
    if (!payload || typeof payload !== "object") return;
    if (payload.event && typeof payload.event === "object") {
      if (seenSimulatorPayloads.has(payload)) return;
      seenSimulatorPayloads.add(payload);
    } else if (typeof payload.kind === "string") {
      payload = { ts: Date.now(), event: payload };
    } else {
      return;
    }
    const event = payload.event;
    grader.record(payload);
    if (event.kind === "code-load") {
      hintState = createHintState();
      hintDebouncer.cancel();
    }
    hintDebouncer.push({ type: "sim_event", payload });
  }
  async function checkSession() {
    if (!runner || !bridgeReady2 || connecting || checkInProgress) return;
    const activeRunner = runner;
    const runToken = runnerToken;
    checkInProgress = true;
    runProgress = /* @__PURE__ */ new Map();
    updateControls();
    recordCheckAttempt(hintState);
    try {
      await sceneIsolation?.prepare();
      if (activeRunner !== runner || runToken !== runnerToken) return;
      const outcome = await activeRunner.runAll({
        onProgress: (progress) => {
          if (activeRunner !== runner || runToken !== runnerToken) return;
          renderRunProgress(progress);
        }
      });
      if (activeRunner !== runner || runToken !== runnerToken) return;
      if (!Object.prototype.hasOwnProperty.call(outcome, "score")) {
        runProgress.clear();
        renderGrades(null);
        return;
      }
      renderGrades(outcome.results, { showFeedback: true });
      evaluateHintEvent({
        type: "test_fail",
        failedCheckCount: outcome.results.filter((result2) => !result2.passed).length
      });
    } catch (error) {
      if (activeRunner !== runner || runToken !== runnerToken) return;
      showToast(`Test run failed: ${error instanceof Error ? error.message : String(error)}`, "error");
    } finally {
      if (activeRunner === runner && runToken === runnerToken) {
        checkInProgress = false;
        updateControls();
      }
    }
  }
  function renderRunProgress(progress) {
    runProgress.set(progress.id, progress.status);
    renderGrades([]);
  }
  async function resetSession() {
    if (connecting) return;
    await connectPreview({ reset: true });
  }
  function evaluateHintEvent(event) {
    clearTimeout(hintTimer);
    hintTimer = void 0;
    latestHintResult = evaluateHints(getConfig().hints, hintState, event, grader.evaluate);
    renderHints();
    if (latestHintResult.nextEvaluationDelayMs !== null) {
      hintTimer = setTimeout(
        () => evaluateHintEvent({ type: "timer" }),
        latestHintResult.nextEvaluationDelayMs
      );
    }
  }
  function renderGrades(results, { showFeedback = false } = {}) {
    const list = document.getElementById("preview-grades");
    list.replaceChildren();
    if (!results) {
      const empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent = "Run the scene, then select Check.";
      list.append(empty);
      document.getElementById("preview-score").textContent = "\u2014";
      return;
    }
    const cases = getConfig().evaluation.test_cases;
    const resultsById = new Map(results.map((result2) => [result2.id, result2]));
    const possible = cases.reduce((sum, testCase) => sum + (testCase.points ?? 1), 0);
    let earned = 0;
    for (const testCase of cases) {
      const result2 = resultsById.get(testCase.id);
      const state2 = result2 ? result2.passed ? "passed" : "failed" : runProgress.get(testCase.id) ?? "not run";
      const points = testCase.points ?? 1;
      if (state2 === "passed") earned += points;
      const row = document.createElement("div");
      row.className = "grade-row";
      row.dataset.passed = String(state2 === "passed");
      row.dataset.status = state2;
      const title = document.createElement("strong");
      title.textContent = testCase.id;
      const detail = document.createElement("span");
      const label = state2 === "passed" ? "PASS" : state2 === "failed" ? "FAIL" : state2 === "running" ? "RUNNING\u2026" : "NOT RUN";
      detail.textContent = `${label} \xB7 ${points} pt${points === 1 ? "" : "s"}`;
      row.append(title, detail);
      if (showFeedback && result2) {
        const feedback = result2.passed ? testCase.feedback_on_pass : testCase.feedback_on_fail;
        const note = document.createElement("span");
        note.className = "grade-feedback";
        if (feedback) {
          const authored = document.createElement("span");
          authored.className = "grade-feedback__authored";
          authored.innerHTML = renderInlineMarkdown(feedback);
          note.append(authored);
        }
        if (!result2.passed && result2.detail) {
          if (note.childNodes.length > 0) note.append(document.createTextNode(" \xB7 "));
          note.append(document.createTextNode(result2.detail));
        }
        if (note.childNodes.length > 0) row.append(note);
      }
      list.append(row);
    }
    const score = possible === 0 ? 0 : Math.round(earned / possible * 100);
    document.getElementById("preview-score").textContent = `${score}%`;
  }
  function renderHints() {
    const panel = document.getElementById("preview-hints");
    panel.replaceChildren();
    const hints = getConfig().hints;
    const manual = getManualHintRequestState(hints, hintState, grader.evaluate);
    if (manual.hasManualHints) {
      const request = document.createElement("button");
      request.type = "button";
      request.className = "btn btn-small btn-secondary";
      request.textContent = "Request hint";
      request.disabled = !manual.canRequest;
      request.addEventListener("click", () => evaluateHintEvent({ type: "manual" }));
      panel.append(request);
    }
    for (const hint of latestHintResult.visibleHints) {
      const card = document.createElement("div");
      card.className = "preview-hint";
      card.dataset.style = hint.style ?? "info";
      card.dataset.triggered = String(hint.triggered);
      card.innerHTML = renderInlineMarkdown(hint.message);
      panel.append(card);
      if (hint.show_once && hint.triggered && hint.display_mode !== "checklist") {
        consumeHint(hintState, hint.id);
      }
    }
  }
  function setPreviewStatus(message, status = "ready") {
    const statusElement = document.getElementById("preview-status");
    if (statusElement) {
      let text = document.getElementById("preview-status-text");
      if (!text) {
        text = document.createElement("span");
        text.id = "preview-status-text";
        statusElement.append(text);
      }
      text.textContent = message;
    }
    const dot = document.getElementById("preview-status-dot");
    if (dot) {
      dot.classList.toggle("is-ready", status === "ready");
      dot.classList.toggle("is-error", status === "error");
    }
  }

  // src/activity-builder/js/export.js
  var import_jszip = __toESM(require_jszip_min(), 1);
  var SIMULATOR_MISSING_MESSAGE = "Simulator build missing \u2014 run `npm run vendor:sim && npm run build`";
  var MANIFEST_FILES = [
    "index.html",
    "css/style.css",
    "js/app.bundle.js",
    "config/activity_config.json",
    "config/scene.swarm",
    "sim/index.html"
  ];
  function exportJSON(config, sceneBundleBase64) {
    const payload = {
      ...config,
      ...typeof sceneBundleBase64 === "string" ? { scene_bundle_base64: sceneBundleBase64 } : {}
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${config.metadata.activity_id || "swarm-activity"}.json`);
  }
  async function exportSCORM(config, sceneBundleBase64) {
    if (typeof sceneBundleBase64 !== "string" || sceneBundleBase64.length === 0) {
      throw new Error("Capture a scene or load a .swarm file before exporting SCORM.");
    }
    let simulatorFiles;
    try {
      const response = await fetch("sim-files.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      simulatorFiles = await response.json();
    } catch {
      throw new Error(SIMULATOR_MISSING_MESSAGE);
    }
    if (!Array.isArray(simulatorFiles) || simulatorFiles.length === 0 || simulatorFiles.some((path) => !isSafeSimulatorPath(path))) {
      throw new Error(SIMULATOR_MISSING_MESSAGE);
    }
    const [indexHtml, styleCss, appBundle] = await Promise.all([
      fetchText("../scorm-template/index.html"),
      fetchText("../scorm-template/css/style.css"),
      fetchText("../scorm-template/js/app.bundle.js")
    ]);
    const zip = new import_jszip.default();
    zip.file("imsmanifest.xml", generateManifest(config));
    zip.file("index.html", indexHtml);
    zip.file("css/style.css", styleCss);
    zip.file("js/app.bundle.js", appBundle);
    zip.file("config/activity_config.json", JSON.stringify(config, null, 2));
    zip.file("config/scene.swarm", base64ToBytes(sceneBundleBase64));
    const fetchedFiles = await Promise.all(simulatorFiles.map(async (path) => {
      let response;
      try {
        response = await fetch(`sim/${path}`);
      } catch (error) {
        throw new Error(`Unable to fetch simulator asset ${path}: ${error.message}`);
      }
      if (!response.ok) throw new Error(`Unable to fetch simulator asset ${path}: HTTP ${response.status}`);
      return [path, await response.arrayBuffer()];
    }));
    for (const [path, content] of fetchedFiles) zip.file(`sim/${path}`, content);
    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: 9 }
    });
    downloadBlob(blob, `${config.metadata.activity_id}.zip`);
  }
  function generateManifest(config) {
    const activityId = escapeXml(config.metadata.activity_id);
    const title = escapeXml(config.metadata.title || "Swarm activity");
    const fileEntries = MANIFEST_FILES.map((path) => `      <file href="${path}"/>`).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="swarm_scorm_${activityId}" version="1.0"
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                              http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="swarm_org">
    <organization identifier="swarm_org">
      <title>${title}</title>
      <item identifier="swarm_item" identifierref="swarm_resource" isvisible="true">
        <title>${title}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="swarm_resource" type="webcontent" adlcp:scormtype="sco" href="index.html">
${fileEntries}
    </resource>
  </resources>
</manifest>`;
  }
  async function fetchText(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Unable to load package template ${path}: HTTP ${response.status}`);
    return response.text();
  }
  function isSafeSimulatorPath(path) {
    return typeof path === "string" && path.length > 0 && !path.startsWith("/") && !path.includes("\\") && path.split("/").every((segment) => segment && segment !== "." && segment !== "..");
  }
  function escapeXml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  // src/activity-builder/js/app.js
  var BUILDER_VERSION = true ? "0.1.0" : "0.0.0-dev";
  var configListeners = /* @__PURE__ */ new Set();
  var sceneListeners = /* @__PURE__ */ new Set();
  var state = {
    config: normalizeConfig({
      metadata: {
        activity_id: "new-swarm-activity",
        title: "Untitled swarm activity",
        instructions_markdown: "",
        learning_objectives_markdown: "",
        teacher_notes_markdown: ""
      },
      evaluation: {
        test_cases: [
          {
            id: "test-1",
            points: 1,
            trigger: [
              { type: "press_button", device_id: null, button: "A", count: 1, interval_ms: 0 }
            ],
            steps: [
              {
                type: "check",
                condition: {
                  type: "serial_output",
                  device_id: null,
                  match: "contains",
                  value: "hello",
                  case_sensitive: true,
                  min_count: 1
                },
                timeout_ms: 5e3
              }
            ]
          }
        ]
      },
      hints: []
    }),
    sceneBundleBase64: null,
    sceneProject: null
  };
  function getConfig() {
    return state.config;
  }
  function setConfig(config, sceneBundleBase64 = null) {
    const normalized = normalizeConfig(config);
    const validation = validateConfig(normalized);
    if (!validation.valid) {
      throw new Error(validation.errors.map((error) => `${error.path || "config"}: ${error.message}`).join("\n"));
    }
    const loadedScene = typeof sceneBundleBase64 === "string" ? decodeSwarmBundle(base64ToBytes(sceneBundleBase64)) : null;
    state.config = normalized;
    state.sceneBundleBase64 = typeof sceneBundleBase64 === "string" ? sceneBundleBase64 : null;
    state.sceneProject = loadedScene;
    notifyConfigChange("import");
    notifySceneChange("import");
  }
  function getSceneBundle() {
    return state.sceneBundleBase64;
  }
  function getSceneProject() {
    return state.sceneProject;
  }
  function setSceneBundle(base64, project, source = "scenario") {
    state.sceneBundleBase64 = base64;
    state.sceneProject = project;
    notifySceneChange(source);
  }
  function notifyConfigChange(source = "editor") {
    for (const listener of configListeners) listener(state.config, source);
  }
  function notifySceneChange(source = "scene") {
    for (const listener of sceneListeners) listener(state.sceneBundleBase64, state.sceneProject, source);
  }
  function onConfigChange(listener) {
    configListeners.add(listener);
    return () => configListeners.delete(listener);
  }
  function onSceneChange(listener) {
    sceneListeners.add(listener);
    return () => sceneListeners.delete(listener);
  }
  function showToast(message, type = "info") {
    const toast = document.getElementById("toast");
    toast.textContent = String(message);
    toast.className = `toast toast-${type}`;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.add("hidden"), 4500);
  }
  function setupTabs() {
    const buttons = [...document.querySelectorAll(".tab-btn")];
    const panels = [...document.querySelectorAll(".tab-panel")];
    for (const button of buttons) {
      button.addEventListener("click", () => {
        const tab = button.dataset.tab;
        for (const candidate of buttons) {
          const active = candidate === button;
          candidate.classList.toggle("active", active);
          candidate.setAttribute("aria-selected", String(active));
        }
        for (const panel of panels) panel.classList.toggle("active", panel.id === `tab-${tab}`);
        window.dispatchEvent(new CustomEvent("tab-activated", { detail: { tab } }));
      });
    }
  }
  function setupHeaderActions() {
    const fileInput = document.getElementById("file-import");
    document.getElementById("btn-import").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      try {
        const imported = JSON.parse(await file.text());
        const sceneBundle = imported.scene_bundle_base64;
        delete imported.scene_bundle_base64;
        setConfig(imported, sceneBundle);
        showToast("Activity JSON imported.", "success");
      } catch (error) {
        showToast(`Import failed: ${error instanceof Error ? error.message : String(error)}`, "error");
      } finally {
        fileInput.value = "";
      }
    });
    document.getElementById("btn-export-json").addEventListener("click", () => {
      const validation = validateConfig(state.config);
      if (!validation.valid) {
        showToast(formatValidationErrors(validation.errors), "error");
        return;
      }
      exportJSON(state.config, state.sceneBundleBase64);
      showToast("Activity JSON downloaded.", "success");
    });
    document.getElementById("btn-export-scorm").addEventListener("click", async () => {
      try {
        const validation = validateConfig(state.config);
        if (!validation.valid) throw new Error(formatValidationErrors(validation.errors));
        await exportSCORM(state.config, state.sceneBundleBase64);
        showToast("SCORM package downloaded.", "success");
      } catch (error) {
        showToast(error instanceof Error ? error.message : String(error), "error");
      }
    });
  }
  function formatValidationErrors(errors) {
    const first = errors.slice(0, 4).map((error) => `${error.path || "config"}: ${error.message}`);
    const more = errors.length > first.length ? `
\u2026and ${errors.length - first.length} more` : "";
    return `Fix ${errors.length} config error(s) before export. ${first.join("; ")}${more}`;
  }
  function initVersionBadge() {
    const badge = document.getElementById("builder-version");
    if (!badge) return;
    badge.textContent = `v${BUILDER_VERSION}`;
    badge.title = `Activity builder version ${BUILDER_VERSION}`;
  }
  function init() {
    setupTabs();
    setupHeaderActions();
    initVersionBadge();
    initConfigTab();
    initScenarioTab();
    initHintsTab();
    initTestsTab();
    initPreviewTab();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
