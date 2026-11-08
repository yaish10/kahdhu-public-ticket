/* Public ticket view for SMS links — same ticket card UI as Finance/Operations. */
(function () {
  var db = window.veyoraDb;
  var root = document.getElementById("tpRoot");
  if (!root || !db) return;

  var WAVE = '<svg viewBox="0 0 64 40"><path d="M2 32C14 8 34 4 58 8 46 12 38 22 30 30 22 38 10 40 2 32Z" fill="#2d8cf0"/><path d="M20 36c10-8 22-8 34-14-4 9-14 16-34 14Z" fill="#0b5ed7"/></svg>';
  var CHECK = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="m7.5 12.5 3 3 6-6.5" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICO = {
    bank: '<path d="M3 10 12 4l9 6M5 10v8h14v-8M2 20h20M9 14v4M15 14v4"/>',
    up: '<path d="M12 16V6M8 10l4-4 4 4M5 20h14"/>',
    copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
    ok: '<path d="m6 12 4 4 8-8"/>',
    warn: '<path d="M12 8v5M12 17h.01"/><path d="M10.3 4.3 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"/>',
    fail: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>'
  };
  var P = {
    cal: '<path d="M5 5h14v15H5zM5 10h14M9 3v4M15 3v4"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    boat: '<path d="M3 17l2 3h14l2-3M5 17V11l7-3 7 3v6M12 8V4"/>',
    seat: '<path d="M6 4h12v9H6zM6 13v5h12v-5"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    ppl: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-4 4-6 8-6s8 2 8 6"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16v1"/>'
  };
  var LABEL = { paid: "PAID", part: "PARTLY PAID", unpaid: "UNPAID", ref: "CANCELLED" };

  function esc(t) {
    return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function ic(p) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + "</svg>";
  }
  function q(name) {
    try { return new URLSearchParams(location.search).get(name) || ""; } catch (e) { return ""; }
  }
  function money(n) {
    var v = Number(n);
    if (!isFinite(v)) return "—";
    return "MVR " + v.toLocaleString("en-MV", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  }
  function logoUrl(path) {
    try {
      if (!path) return "";
      return db.storage.from("company-logos").getPublicUrl(path).data.publicUrl || "";
    } catch (e) { return ""; }
  }
  function qr(text) {
    try {
      if (!window.qrcode) return "";
      var qrc = window.qrcode(0, "M");
      qrc.addData(String(text));
      qrc.make();
      var n = qrc.getModuleCount(), d = "", r, c;
      for (r = 0; r < n; r++) for (c = 0; c < n; c++) if (qrc.isDark(r, c)) d += "M" + c + " " + r + "h1v1h-1z";
      return '<svg viewBox="0 0 ' + n + " " + n + '" shape-rendering="crispEdges"><path d="' + d + '" fill="#0b1f44"/></svg>';
    } catch (e) { return ""; }
  }
  function msg(title, body, kind) {
    root.innerHTML = '<div class="tp-msg ' + (kind || "") + '"><strong>' + esc(title) + '</strong>' + esc(body) + '</div>';
  }
  function tile(cls, icon, label, value) {
    return '<div class="pk-tile ' + cls + '"><span>' + ic(icon) + '</span><div><small>' + label + '</small><b>' + esc(value) + '</b></div></div>';
  }
  function payKind(b) {
    var pay = b.payment_status || "Unpaid";
    var total = Number(b.fare_total) || 0;
    var paid = Number(b.paid_amount) || 0;
    if (/cancel|refund/i.test(b.status || "") || /refund/i.test(pay)) return "ref";
    if (/^paid$/i.test(pay) || (total > 0 && paid >= total)) return "paid";
    if (/part/i.test(pay) || paid > 0) return "part";
    return "unpaid";
  }
  function slipLib() {
    if (window.VeyoraSlip) return Promise.resolve(window.VeyoraSlip);
    function load(src) {
      return new Promise(function (ok, fail) {
        var s = document.createElement("script");
        s.src = src;
        s.onload = function () { window.VeyoraSlip ? ok(window.VeyoraSlip) : fail(new Error("Slip reader missing.")); };
        s.onerror = function () { fail(new Error("Could not load the slip reader.")); };
        document.head.appendChild(s);
      });
    }
    return load("slip-ocr.js?v=20261108pay1").catch(function () {
      return load("https://cdn.jsdelivr.net/gh/yaish10/kahdhu-public-ticket@main/slip-ocr.js?v=20261108pay1");
    });
  }
  function checksHtml(checks) {
    if (!checks || !checks.length) return "";
    return '<ul class="tp-checks">' + checks.map(function (c) {
      var ico = c.level === "pass" ? ICO.ok : c.level === "warn" ? ICO.warn : ICO.fail;
      return '<li class="' + esc(c.level) + '"><i>' + ic(ico) + '</i><span>' + esc(c.msg) + '</span></li>';
    }).join("") + "</ul>";
  }

  var ref = q("r").trim();
  var token = q("k").trim().toLowerCase();
  if (!ref || !/^[0-9a-f]{32}$/.test(token)) {
    msg("Link not valid", "Open the link from your booking text message.", "bad");
    return;
  }

  function loadTicket() {
    return db.rpc("public_ticket_view", {
      p_host: location.hostname,
      p_ref: ref,
      p_token: token
    });
  }

  function render(d) {
    if (!d || !d.ok) {
      msg("Ticket not found", (d && d.error) || "This ticket link is not valid.", "bad");
      return;
    }

    var co = d.company || {};
    var b = d.booking || {};
    var t = d.trip || {};
    var pax = Array.isArray(d.passengers) ? d.passengers : [];
    var pay = d.pay || {};
    var lg = logoUrl(co.logo_path);
    var dep = t.depart_at ? new Date(t.depart_at) : null;
    var kind = payKind(b);
    var total = Number(b.fare_total) || 0;
    var paid = Number(b.paid_amount) || 0;
    var due = Number(pay.amount_due != null ? pay.amount_due : Math.max(0, total - paid)) || 0;
    if (kind === "ref") due = 0;
    var seats = pax.map(function (p) { return p.seat_no; }).filter(Boolean);
    var name = b.contact_name || (pax[0] && pax[0].full_name) || "Passenger";
    var phone = b.contact_phone || "";
    var init = String(name || "?").trim().split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase();
    var qsvg = qr("TICKET:" + (b.reference || ref));
    var late = dep && dep.getTime() < Date.now() && (kind === "unpaid" || kind === "part");

    document.title = (co.name ? co.name + " · " : "") + (b.reference || "Ticket");

    var head =
      '<div class="tp-head">' + (lg ? '<img src="' + esc(lg) + '" alt="">' : "") +
        '<div><small>Passenger ticket</small><b>' + esc(co.name || "Transport") + '</b></div></div>';

    if (d.waiting) {
      root.innerHTML = head +
        '<div class="tp-msg warn"><strong>Waiting for approval</strong>' +
          'Reference ' + esc(b.reference || ref) + ' is not confirmed yet. You will get another text with your ticket when it is approved.</div>' +
        '<p class="tp-foot">This page only shows your booking. It does not open company staff tools.</p>';
      return;
    }
    if (!d.show_ticket) {
      root.innerHTML = head +
        '<div class="tp-msg bad"><strong>Booking cancelled</strong>' +
          'Reference ' + esc(b.reference || ref) + ' is no longer active.</div>' +
        '<p class="tp-foot">This page only shows your booking. It does not open company staff tools.</p>';
      return;
    }

    var card =
      '<article class="ft ft2 pk" aria-label="Passenger ticket">' +
        '<div class="ft-main">' +
          '<svg class="ft-wave" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30C80 55 200 0 400 6V0H0Z" fill="#1677e8" opacity=".1"/></svg>' +
          '<div class="ft-top2"><span class="ft-brand">' + (lg ? '<img src="' + esc(lg) + '" alt="">' : WAVE) + '<b>' + esc(co.name || "Transport Service") + '</b></span>' +
            '<i class="ft-sep"></i><span class="ft-kind">Passenger Ticket</span>' +
            (late ? '<span class="pk-flag">Trip departed</span>' : "") +
            '<span class="ft-badge pay-' + kind + '">' + (kind === "paid" ? CHECK : "") + LABEL[kind] + '</span></div>' +
          '<div class="pk-route"><div class="pk-city"><small>From</small><b>' + esc(t.origin || "—") + '</b></div>' +
            '<div class="pk-city r"><small>To</small><b>' + esc(t.destination || "—") + '</b></div></div>' +
          '<div class="pk-tiles">' +
            tile("blue", P.cal, "Trip date", dep ? dep.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Indian/Maldives" }) : "—") +
            tile("violet", P.clock, "Departure", dep ? dep.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Indian/Maldives" }) : "—") +
            tile("teal", P.boat, "Vessel", t.vessel || "—") +
            tile("amber", P.seat, "Seats booked", String(pax.length || b.passenger_count || 0)) +
          '</div>' +
          '<div class="pk-panel"><div class="pk-who"><span class="tkc-av">' + esc(init) + '</span><div><small>Customer</small><strong>' + esc(name) + '</strong><em>' + ic(P.phone) + esc(phone || "No phone") + '</em></div></div>' +
            '<div class="pk-seatbox"><small>Seats</small>' +
              (seats.length ? '<span class="tkc-seats">' + seats.map(function (x) { return '<i>' + esc(x) + '</i>'; }).join("") + '</span>' : '<span class="pk-noseat">Not assigned</span>') +
              '<span class="pk-pax">' + ic(P.ppl) + (pax.length || b.passenger_count || 0) + ((pax.length || b.passenger_count || 0) === 1 ? " passenger" : " passengers") + '</span></div>' +
            '<div class="pk-pay"><small>Payment' + (b.payment_method ? " · " + esc(b.payment_method) : "") + '</small><div class="pk-amts">' +
              (paid > 0 && kind !== "ref" ? '<div class="pk-box paid">' + CHECK + '<div><span>Paid</span><b>' + esc(money(paid)) + '</b></div></div>' : "") +
              (due > 0 ? '<div class="pk-box due">' + ic(P.alert) + '<div><span>Due</span><b>' + esc(money(due)) + '</b></div></div>' :
                kind === "ref" ? '<div class="pk-box ref">' + ic('<circle cx="12" cy="12" r="9"/><path d="M8 8l8 8M16 8l-8 8"/>') + '<div><span>Status</span><b>Cancelled</b></div></div>' : "") +
            '</div><span class="pk-fare">Fare ' + esc(money(total)) + '</span></div></div>' +
        '</div>' +
        '<div class="ft-stub"><i class="ft-n t"></i><i class="ft-n b"></i><small>Booking ID</small><div class="ft-id">' + esc(b.reference || ref) + '</div>' +
          '<div class="ft-qr' + (qsvg ? "" : " ph") + '">' + (qsvg || "QR") + '</div>' +
          '<div class="ft-scan">Trip ' + esc(t.code || "—") + '</div>' +
          '<div class="ft-paybox pk-' + kind + '">' + (kind === "paid" ? CHECK : ic(P.alert)) +
            '<div><small>' + (due > 0 ? "Amount due" : "Payment Status") + '</small><b>' +
              (due > 0 ? esc(money(due)) : kind === "ref" ? "Cancelled" : "Paid") + '</b>' +
              (total ? '<small>' + (kind === "paid" ? esc(money(total)) + " settled" : "of " + esc(money(total)) + (paid ? " · paid " + esc(money(paid)) : "")) + '</small>' : "") +
            '</div></div>' +
        '</div>' +
      '</article>';

    var paxBlock = '<section class="tp-pax-list"><h2>Passengers</h2><ul>' +
      (pax.length ? pax.map(function (p) {
        return '<li><div><strong>' + esc(p.full_name || "Passenger") + '</strong><em>' +
          esc([p.category, p.status].filter(Boolean).join(" · ") || "Passenger") + '</em></div>' +
          (p.seat_no ? '<span class="tp-seat">' + esc(p.seat_no) + '</span>' : "") + '</li>';
      }).join("") : '<li><div><strong>No passenger names yet</strong><em>Contact the operator if this looks wrong.</em></div></li>') +
      '</ul></section>';

    var payBlock = "";
    if (pay.can_pay && due > 0) {
      payBlock = '<section class="tp-pay" id="tpPay">' +
        '<div class="tp-pay-head"><div><h2>Pay outstanding</h2><p>Transfer ' + esc(money(due)) + ' to this company, then upload your bank slip. We scan it the same way as KAHDHU subscription payments.</p></div>' +
          '<button type="button" class="tp-pay-cta" id="tpPayOpen">Pay outstanding · ' + esc(money(due)) + '</button></div>' +
        '<div id="tpPayPanel" class="tp-pay-panel" hidden></div></section>';
    } else if (pay.slip && pay.slip.status && pay.slip.status !== "none") {
      var st = pay.slip.status;
      payBlock = '<section class="tp-pay"><div class="tp-pay-res ' + esc(st) + '"><strong>' +
        (st === "verified" || pay.slip.applied ? "Payment received" : st === "review" ? "Slip under review" : "Slip not accepted") +
        '</strong><span>' +
        (st === "verified" || pay.slip.applied ? "This ticket is marked paid." : st === "review" ? "The company will check your slip shortly." : "Upload a clearer slip or pay into the correct company account.") +
        '</span></div>' + checksHtml(pay.slip.checks || []) +
        (st === "rejected" ? '<button type="button" class="tp-pay-cta" id="tpPayOpen">Try again</button>' : "") +
        '</section>';
    }

    root.innerHTML = head + card + paxBlock + payBlock +
      '<p class="tp-foot">This page only shows your booking. It does not open company staff tools.</p>';

    var openBtn = document.getElementById("tpPayOpen");
    if (openBtn) openBtn.addEventListener("click", function () { openPay(d); });
  }

  function openPay(d) {
    var panel = document.getElementById("tpPayPanel");
    var openBtn = document.getElementById("tpPayOpen");
    if (!panel) return;
    if (openBtn) openBtn.hidden = true;
    panel.hidden = false;

    var S = {
      accounts: (d.pay && d.pay.accounts) || [],
      acct: null,
      file: null,
      preview: "",
      fields: null,
      checks: [],
      reading: 0,
      busy: false,
      booking: d.booking || {},
      company: d.company || {},
      due: Number(d.pay && d.pay.amount_due) || 0,
      currency: (d.pay && d.pay.currency) || "MVR"
    };
    if (S.accounts[0]) S.acct = S.accounts[0].id;

    function acctObj() {
      return S.accounts.filter(function (a) { return a.id === S.acct; })[0];
    }
    function say(t, kind) {
      var el = document.getElementById("tpPayMsg");
      if (el) { el.textContent = t || ""; el.className = "tp-pay-msg" + (kind ? " " + kind : ""); }
    }
    function recheck() {
      var a = acctObj();
      if (!S.fields || !a || !window.VeyoraSlip) { S.checks = []; return; }
      S.checks = window.VeyoraSlip.check(S.fields, {
        amount: S.due,
        currency: S.currency,
        account_no: a.account_no,
        bank: a.bank,
        createdAt: S.booking.created_at,
        amountLabel: "amount due",
        matchLabel: "covers the outstanding balance.",
        beforeLabel: "this booking was created.",
        afterLabel: "Transfer made after the booking was created."
      });
    }
    function fieldsHtml() {
      var f = S.fields;
      if (!f) return "";
      function inp(k, label, ph) {
        return '<label class="tp-fld"><span>' + label + '</span><input data-f="' + k + '" value="' + esc(f[k] || "") + '" placeholder="' + ph + '" autocomplete="off"></label>';
      }
      return '<div class="tp-read"><h3>What we read on your slip <small>' + esc([f.bank, f.transaction_type].filter(Boolean).join(" · ") || "Fix anything that is wrong") + '</small></h3><div class="tp-fields">' +
        inp("amount", "Amount", "0.00") + inp("to_account", "Paid to account", "Account number") +
        inp("reference_no", "Reference", "Reference or Id#") + inp("transaction_date", "Date and time", "YYYY-MM-DD HH:MM:SS") +
        '<label class="tp-fld"><span>Status</span><select data-f="status"><option value="">Not read</option><option value="SUCCESS"' + (/succ|compl/i.test(f.status || "") ? " selected" : "") + '>Success</option><option value="FAILED"' + (/fail/i.test(f.status || "") ? " selected" : "") + '>Failed</option></select></label>' +
        '<label class="tp-fld"><span>Bank</span><input data-f="bank" value="' + esc(f.bank || "") + '" placeholder="MIB or BML" autocomplete="off"></label></div><div id="tpChecks"></div></div>';
    }
    function paintChecks() {
      var el = document.getElementById("tpChecks");
      if (el) el.innerHTML = checksHtml(S.checks);
      var btn = document.getElementById("tpPaySubmit");
      if (btn) {
        var v = S.checks.length && window.VeyoraSlip ? window.VeyoraSlip.verdict(S.checks) : "none";
        btn.disabled = S.busy || !S.file || v === "rejected" || v === "none";
        btn.textContent = v === "rejected" ? "Fix the problems above" : v === "review" ? "Submit for review" : "Submit slip";
      }
    }
    function drawPay() {
      panel.innerHTML =
        (S.accounts.length
          ? '<h3 class="tp-pay-h">1. Transfer to this company account</h3><div class="tp-accts" role="radiogroup">' + S.accounts.map(function (x) {
              return '<div class="tp-acct' + (x.id === S.acct ? " on" : "") + '" role="radio" tabindex="0" data-acct="' + esc(x.id) + '">' +
                '<span class="tp-bk">' + ic(ICO.bank) + '</span><span class="tp-ai"><strong>' + esc(x.bank) + '</strong><small>' + esc(x.account_name) + '</small><code>' + esc(x.account_no) + '</code>' +
                (x.note ? '<em>' + esc(x.note) + '</em>' : "") + '</span>' +
                '<button type="button" class="tp-copy" data-copy="' + esc(x.account_no) + '">' + ic(ICO.copy) + '<span>Copy</span></button></div>';
            }).join("") + "</div>"
          : '<p class="tp-pay-none">This company has not published a receiving account yet. Contact the operator to pay.</p>') +
        '<h3 class="tp-pay-h">2. Upload your transfer slip</h3>' +
        '<label class="tp-drop" id="tpDrop"><input type="file" id="tpFile" accept="image/png,image/jpeg,image/webp">' +
          '<span>' + ic(ICO.up) + '</span><strong>' + (S.file ? "Choose a different slip" : "Drop your slip here or click to choose") + '</strong>' +
          '<small>Screenshot or photo · PNG, JPG or WebP · up to 8 MB</small></label>' +
        '<div id="tpReadBox">' + (S.preview ? '<div class="tp-prev"><img src="' + esc(S.preview) + '" alt="Your slip"><div class="tp-prog" id="tpProg"' + (S.reading ? "" : " hidden") + '><i style="width:' + Math.round((S.reading || 0) * 100) + '%"></i><span>Reading your slip…</span></div></div>' : "") +
          fieldsHtml() + "</div>" +
        '<button type="button" class="tp-pay-cta" id="tpPaySubmit" disabled>Submit slip</button>' +
        '<p class="tp-pay-msg" id="tpPayMsg" role="status"></p>';

      paintChecks();
      [].forEach.call(panel.querySelectorAll("[data-acct]"), function (el) {
        el.addEventListener("click", function (e) {
          if (e.target.closest("[data-copy]")) return;
          S.acct = el.getAttribute("data-acct");
          recheck();
          drawPay();
        });
      });
      [].forEach.call(panel.querySelectorAll("[data-copy]"), function (b) {
        b.addEventListener("click", function () {
          var t = b.getAttribute("data-copy");
          var done = function () { b.classList.add("ok"); b.querySelector("span").textContent = "Copied"; setTimeout(function () { b.classList.remove("ok"); b.querySelector("span").textContent = "Copy"; }, 1200); };
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, done); else done();
        });
      });
      var drop = document.getElementById("tpDrop"), file = document.getElementById("tpFile");
      if (drop && file) {
        ["dragover", "dragenter"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
        ["dragleave", "drop"].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
        drop.addEventListener("drop", function (e) { if (e.dataTransfer && e.dataTransfer.files[0]) takeFile(e.dataTransfer.files[0]); });
        file.addEventListener("change", function () { if (file.files[0]) takeFile(file.files[0]); });
      }
      [].forEach.call(panel.querySelectorAll("[data-f]"), function (el) {
        el.addEventListener("input", function () { S.fields[el.getAttribute("data-f")] = el.value.trim(); recheck(); paintChecks(); });
        el.addEventListener("change", function () { S.fields[el.getAttribute("data-f")] = el.value.trim(); recheck(); paintChecks(); });
      });
      var sub = document.getElementById("tpPaySubmit");
      if (sub) sub.addEventListener("click", submit);
    }

    function takeFile(f) {
      if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { say("Use a PNG, JPG or WebP image of the slip.", "err"); return; }
      if (f.size > 8 * 1024 * 1024) { say("That image is over 8 MB.", "err"); return; }
      S.file = f; S.fields = null; S.checks = []; S.reading = 0.02;
      try { if (S.preview) URL.revokeObjectURL(S.preview); } catch (e) {}
      S.preview = URL.createObjectURL(f);
      drawPay();
      slipLib().then(function (L) {
        return L.read(f, function (p) {
          S.reading = Math.max(0.05, p);
          var bar = document.querySelector("#tpProg i");
          if (bar) bar.style.width = Math.round(p * 100) + "%";
        });
      }).then(function (res) {
        S.reading = 0; S.fields = res.fields; recheck(); drawPay();
        if (!S.fields.amount && !S.fields.reference_no && !S.fields.to_account) {
          say("We could not read this image. Try a clearer screenshot of the slip.", "err");
        }
      }, function (e) {
        S.reading = 0; S.fields = {}; recheck(); drawPay();
        say((e && e.message) || "Could not read the slip. Fill the details in by hand.", "err");
      });
    }

    function submit() {
      if (S.busy || !S.file || !S.fields || !S.acct) return;
      if (!S.booking.id || !S.company.id) { say("Ticket details are incomplete. Refresh and try again.", "err"); return; }
      S.busy = true; paintChecks(); say("Uploading your slip…");
      var ext = S.file.type === "image/png" ? "png" : S.file.type === "image/webp" ? "webp" : "jpg";
      var path = S.company.id + "/" + S.booking.id + "/" + Date.now() + "." + ext;
      Promise.resolve(db.storage.from("booking-slips").upload(path, S.file, { contentType: S.file.type, upsert: false })).then(function (up) {
        if (up.error) throw new Error(up.error.message);
        return db.rpc("public_ticket_submit_slip", {
          p_ref: ref,
          p_token: token,
          p_account: S.acct,
          p_path: path,
          p_ocr: S.fields
        });
      }).then(function (r) {
        S.busy = false;
        if (r.error) { say(r.error.message, "err"); paintChecks(); return; }
        var out = r.data || {};
        if (out.applied) {
          say("Payment verified. Reloading your ticket…", "ok");
          setTimeout(function () { reload(); }, 1200);
          return;
        }
        panel.innerHTML = '<div class="tp-pay-res ' + esc(out.slip_status || "") + '"><strong>' +
          (out.slip_status === "review" ? "Slip received for review" : out.slip_status === "rejected" ? "Slip not accepted" : "Slip received") +
          '</strong><span>' +
          (out.slip_status === "review" ? "Some details need a person to check. The company will update this ticket soon." :
            out.slip_status === "rejected" ? "Fix the problems below and try again with the correct company account." : "Thank you.") +
          '</span></div>' + checksHtml(out.checks || []) +
          (out.slip_status === "rejected" ? '<button type="button" class="tp-pay-cta" id="tpPayRetry">Upload another slip</button>' : "");
        var retry = document.getElementById("tpPayRetry");
        if (retry) retry.addEventListener("click", function () {
          S.file = null; S.fields = null; S.checks = []; S.preview = ""; drawPay();
        });
      }, function (e) {
        S.busy = false; say(e.message || "Upload failed.", "err"); paintChecks();
      });
    }

    if (!S.accounts.length) {
      panel.innerHTML = '<p class="tp-pay-none">This company has not published a receiving account yet. Ask the operator for their bank details.</p>';
      return;
    }
    drawPay();
  }

  function reload() {
    root.innerHTML = '<p class="tp-load">Opening your ticket…</p>';
    loadTicket().then(function (r) {
      if (r.error) {
        var miss = /public_ticket_view|schema cache|does not exist/i.test(r.error.message || "");
        msg("Could not open ticket", miss ? "Run migration 0154_public_ticket_pay_slip.sql, then try again." : r.error.message, "bad");
        return;
      }
      render(r.data || {});
    }, function (e) {
      msg("Could not open ticket", (e && e.message) || "Try again later.", "bad");
    });
  }

  reload();
})();
