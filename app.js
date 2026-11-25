(() => {
  'use strict';

  // Enable full UTF-8 support in qrcode-generator for international names & addresses
  if (typeof qrcode !== 'undefined' && qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  }

  const STORAGE_KEY = 'contact_qr_webapp_v1';
  const SAVED_LIST_KEY = 'contact_qr_saved_list_v1';
  const THEME_STORAGE_KEY = 'contact_qr_theme_v1';

  const FIELD_IDS = [
    'prefix', 'firstName', 'middleName', 'lastName', 'nameSuffix', 'nickname',
    'phoneticFirstName', 'phoneticLastName',
    'mobilePhone', 'workPhone', 'homePhone', 'mainPhone', 'workFax', 'homeFax', 'pagerPhone', 'otherPhone',
    'title', 'role', 'department', 'company',
    'workEmail', 'privateEmail', 'otherEmail',
    'workStreet', 'workCity', 'workState', 'workPostcode', 'workCountry',
    'privateStreet', 'privateCity', 'privateState', 'privatePostcode', 'privateCountry',
    'otherStreet', 'otherCity', 'otherState', 'otherPostcode', 'otherCountry',
    'birthdate', 'nameDay',
    'workWebsite', 'privateWebsite',
    'notes'
  ];

  const SAMPLE_DATA = {
    prefix: 'Dr.',
    firstName: 'Jane',
    middleName: 'Marie',
    lastName: 'Doe',
    nameSuffix: 'PhD',
    nickname: 'Janie',
    phoneticFirstName: 'Jayn',
    phoneticLastName: 'Doh',
    mobilePhone: '+1 555 234 5678',
    workPhone: '+1 555 876 5432',
    homePhone: '+1 555 345 6789',
    mainPhone: '+1 555 100 0000',
    workFax: '+1 555 876 5430',
    homeFax: '+1 555 345 6780',
    pagerPhone: '+1 555 900 1234',
    otherPhone: '+1 555 456 7890',
    title: 'Product Director',
    role: 'Executive Leader',
    department: 'Engineering',
    company: 'Acme Corporation',
    workEmail: 'jane.doe@acme.com',
    privateEmail: 'jane.doe@example.com',
    otherEmail: 'contact@janedoe.org',
    workStreet: '100 Innovation Way, Suite 400',
    workCity: 'San Francisco',
    workState: 'CA',
    workPostcode: '94105',
    workCountry: 'USA',
    privateStreet: '42 Maple Avenue',
    privateCity: 'Oakland',
    privateState: 'CA',
    privatePostcode: '94612',
    privateCountry: 'USA',
    otherStreet: '12 Pine Mountain Rd',
    otherCity: 'Tahoe City',
    otherState: 'CA',
    otherPostcode: '96145',
    otherCountry: 'USA',
    birthdate: '1990-05-14',
    nameDay: '05-12',
    workWebsite: 'https://acme.com',
    privateWebsite: 'https://janedoe.dev',
    notes: 'Key contact person for Q3 enterprise projects. Met at Munich Summit.'
  };

  let compatTarget = 'both'; // 'both' | 'iphone' | 'android'
  let previewOs = 'iphone'; // 'iphone' | 'android'
  let currentQr = null;
  let currentVCard = '';
  let currentDisplayName = 'New Contact';

  // DOM references
  const form = document.getElementById('contact-form');
  const qrOutput = document.getElementById('qr-output');
  const qrEmpty = document.getElementById('qr-empty');
  const statusPill = document.getElementById('qr-status-pill');
  const summaryName = document.getElementById('summary-name');
  const summaryMeta = document.getElementById('summary-meta');
  const metricBytes = document.getElementById('metric-bytes');
  const metricVersion = document.getElementById('metric-version');
  const metricEcc = document.getElementById('metric-ecc');

  const btnDownloadPng = document.getElementById('btn-download-png');
  const btnDownloadSvg = document.getElementById('btn-download-svg');
  const btnDownloadVcf = document.getElementById('btn-download-vcf');
  const btnCopyVcard = document.getElementById('btn-copy-vcard');
  const btnSample = document.getElementById('btn-sample');
  const btnClear = document.getElementById('btn-clear');
  const btnViewVcard = document.getElementById('btn-view-vcard');
  const btnCopyAddress = document.getElementById('btn-copy-address');

  const nameDayInput = document.getElementById('nameDay');
  const nameDayPicker = document.getElementById('nameDayPicker');

  const vcardModal = document.getElementById('vcard-modal');
  const vcardRaw = document.getElementById('vcard-raw');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnModalClose = document.getElementById('btn-modal-close');
  const btnModalCopy = document.getElementById('btn-modal-copy');

  const segButtons = Array.from(document.querySelectorAll('.seg-btn'));
  const osButtons = Array.from(document.querySelectorAll('.os-btn'));
  const phoneFrame = document.getElementById('phone-frame');
  const phoneScreen = document.getElementById('phone-screen');
  const sbTime = document.getElementById('sb-time');

  const savedContactsSelect = document.getElementById('saved-contacts-select');
  const btnSaveContact = document.getElementById('btn-save-contact');
  const btnDeleteContact = document.getElementById('btn-delete-contact');
  const btnLoadVcf = document.getElementById('btn-load-vcf');
  const vcfFileInput = document.getElementById('vcf-file-input');

  function getValues() {
    const data = {};
    for (const id of FIELD_IDS) {
      const el = document.getElementById(id);
      const val = el ? el.value.trim() : '';
      data[id] = val;
      if (el) {
        el.classList.toggle('is-filled', val.length > 0);
      }
    }
    return data;
  }

  function escapeVCardValue(val) {
    return String(val)
      .replace(/\\/g, '\\\\')
      .replace(/\r\n|\r|\n/g, '\\n')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,');
  }

  function escapeDisplayValue(val) {
    return String(val)
      .replace(/\\/g, '\\\\')
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/;/g, '\\;');
  }

  function escapeUrlValue(val) {
    const trimmed = val.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  }

  function parseNameDay(raw) {
    const v = raw.trim();
    if (!v) return null;

    // Match YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
    const fullMatch = v.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\.?$/);
    if (fullMatch) {
      const yyyy = fullMatch[1];
      const mm = fullMatch[2].padStart(2, '0');
      const dd = fullMatch[3].padStart(2, '0');
      return { kind: 'full', iso: `${yyyy}-${mm}-${dd}` };
    }

    // Match MM-DD, MM/DD, DD.MM.
    const shortMatch = v.match(/^(\d{1,2})[-/.](\d{1,2})\.?$/);
    if (shortMatch) {
      let a = parseInt(shortMatch[1], 10);
      let b = parseInt(shortMatch[2], 10);
      let mm = a;
      let dd = b;
      // If user typed European DD.MM (e.g. 25.11), swap when first > 12 and second <= 12
      if (a > 12 && b <= 12) {
        mm = b;
        dd = a;
      }
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        return {
          kind: 'mmdd',
          mm: String(mm).padStart(2, '0'),
          dd: String(dd).padStart(2, '0')
        };
      }
    }

    return { kind: 'text', raw: v };
  }

  function buildDisplayName(d) {
    const main = [d.prefix, d.firstName, d.middleName, d.lastName].filter(Boolean).join(' ');
    if (main && d.nameSuffix) return `${main}, ${d.nameSuffix}`;
    if (main) return main;
    if (d.nameSuffix) return d.nameSuffix;
    return d.nickname || d.company || d.mobilePhone || d.workPhone || d.homePhone || d.workEmail || d.privateEmail || 'New Contact';
  }

  function buildVCard(d, target) {
    const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
    let itemIndex = 1;

    const hasNameParts = d.prefix || d.firstName || d.middleName || d.lastName || d.nameSuffix;
    const fn = buildDisplayName(d);

    // Both Android and iOS expect N and FN
    if (hasNameParts) {
      lines.push(
        `N:${[d.lastName, d.firstName, d.middleName, d.prefix, d.nameSuffix].map(escapeVCardValue).join(';')}`
      );
    } else {
      lines.push(`N:;${escapeVCardValue(fn)};;;`);
    }
    lines.push(`FN:${escapeDisplayValue(fn)}`);

    if (d.nickname) {
      lines.push(`NICKNAME:${escapeVCardValue(d.nickname)}`);
    }

    if (d.phoneticFirstName) {
      lines.push(`X-PHONETIC-FIRST-NAME:${escapeVCardValue(d.phoneticFirstName)}`);
    }
    if (d.phoneticLastName) {
      lines.push(`X-PHONETIC-LAST-NAME:${escapeVCardValue(d.phoneticLastName)}`);
    }

    // Group 2: Phone numbers
    if (d.mobilePhone) lines.push(`TEL;TYPE=CELL:${d.mobilePhone}`);
    if (d.workPhone) lines.push(`TEL;TYPE=WORK:${d.workPhone}`);
    if (d.homePhone) lines.push(`TEL;TYPE=HOME:${d.homePhone}`);
    if (d.mainPhone) lines.push(`TEL;TYPE=MAIN:${d.mainPhone}`);
    if (d.workFax) lines.push(`TEL;TYPE=WORK,FAX:${d.workFax}`);
    if (d.homeFax) lines.push(`TEL;TYPE=HOME,FAX:${d.homeFax}`);
    if (d.pagerPhone) lines.push(`TEL;TYPE=PAGER:${d.pagerPhone}`);
    if (d.otherPhone) lines.push(`TEL;TYPE=VOICE:${d.otherPhone}`);

    // Group 3: Work details
    if (d.company || d.department) {
      const orgParts = [escapeVCardValue(d.company)];
      if (d.department) orgParts.push(escapeVCardValue(d.department));
      lines.push(`ORG:${orgParts.join(';')}`);
    }
    if (d.title) {
      lines.push(`TITLE:${escapeVCardValue(d.title)}`);
    }
    if (d.role) {
      lines.push(`ROLE:${escapeVCardValue(d.role)}`);
    }

    // Group 4: E-mail addresses
    if (d.workEmail) lines.push(`EMAIL;TYPE=WORK:${escapeVCardValue(d.workEmail)}`);
    if (d.privateEmail) lines.push(`EMAIL;TYPE=HOME:${escapeVCardValue(d.privateEmail)}`);
    if (d.otherEmail) lines.push(`EMAIL;TYPE=OTHER:${escapeVCardValue(d.otherEmail)}`);

    // Group 5: Addresses (Work, Home, Other)
    const hasWorkAddr = d.workStreet || d.workCity || d.workState || d.workPostcode || d.workCountry;
    if (hasWorkAddr) {
      const adr = ['', '', d.workStreet, d.workCity, d.workState, d.workPostcode, d.workCountry]
        .map(escapeVCardValue)
        .join(';');
      lines.push(`ADR;TYPE=WORK:${adr}`);
    }

    const hasPrivateAddr = d.privateStreet || d.privateCity || d.privateState || d.privatePostcode || d.privateCountry;
    if (hasPrivateAddr) {
      const adr = ['', '', d.privateStreet, d.privateCity, d.privateState, d.privatePostcode, d.privateCountry]
        .map(escapeVCardValue)
        .join(';');
      lines.push(`ADR;TYPE=HOME:${adr}`);
    }

    const hasOtherAddr = d.otherStreet || d.otherCity || d.otherState || d.otherPostcode || d.otherCountry;
    if (hasOtherAddr) {
      const adr = ['', '', d.otherStreet, d.otherCity, d.otherState, d.otherPostcode, d.otherCountry]
        .map(escapeVCardValue)
        .join(';');
      lines.push(`ADR;TYPE=OTHER:${adr}`);
    }

    // Group 6: Dates
    if (d.birthdate) {
      lines.push(`BDAY:${d.birthdate}`);
    }

    const parsedNameDay = parseNameDay(d.nameDay);
    if (parsedNameDay) {
      if (parsedNameDay.kind === 'full') {
        if (target === 'iphone' || target === 'both') {
          lines.push(`item${itemIndex}.X-ABDATE:${parsedNameDay.iso}`);
          lines.push(`item${itemIndex}.X-ABLabel:Name day`);
          itemIndex += 1;
        }
        if (target === 'android' || target === 'both') {
          lines.push(`X-ANDROID-CUSTOM:vnd.android.cursor.item/contact_event;${parsedNameDay.iso};0;Name day;;;;;;;;;;;;`);
        }
      } else if (parsedNameDay.kind === 'mmdd') {
        if (target === 'iphone' || target === 'both') {
          // 1604 is Apple's sentinel year for dates without a year
          lines.push(`item${itemIndex}.X-ABDATE:1604-${parsedNameDay.mm}-${parsedNameDay.dd}`);
          lines.push(`item${itemIndex}.X-ABLabel:Name day`);
          itemIndex += 1;
        }
        if (target === 'android' || target === 'both') {
          lines.push(`X-ANDROID-CUSTOM:vnd.android.cursor.item/contact_event;--${parsedNameDay.mm}-${parsedNameDay.dd};0;Name day;;;;;;;;;;;;`);
        }
      } else {
        lines.push(`NOTE:Name day: ${escapeVCardValue(parsedNameDay.raw)}`);
      }
    }

    // Group 7: Websites
    if (d.workWebsite) {
      const url = escapeUrlValue(d.workWebsite);
      if (target === 'iphone') {
        lines.push(`item${itemIndex}.URL:${url}`);
        lines.push(`item${itemIndex}.X-ABLabel:_$!<Work>!$_`);
        itemIndex += 1;
      } else {
        lines.push(`URL;TYPE=WORK:${url}`);
      }
    }

    if (d.privateWebsite) {
      const url = escapeUrlValue(d.privateWebsite);
      if (target === 'iphone') {
        lines.push(`item${itemIndex}.URL:${url}`);
        lines.push(`item${itemIndex}.X-ABLabel:_$!<Home>!$_`);
        itemIndex += 1;
      } else {
        lines.push(`URL;TYPE=HOME:${url}`);
      }
    }

    // Group 8: Notes
    if (d.notes) {
      lines.push(`NOTE:${escapeVCardValue(d.notes)}`);
    }

    lines.push('END:VCARD');
    return lines.join('\r\n');
  }

  function utf8ByteLength(str) {
    return new TextEncoder().encode(str).length;
  }

  function generateQr(payload) {
    const eccOrder = ['M', 'L'];
    for (const ecc of eccOrder) {
      try {
        const qr = qrcode(0, ecc);
        qr.addData(payload);
        qr.make();
        return { qr, ecc };
      } catch (_) {
        // Payload exceeded capacity at this ECC level; fall back to lower ECC
      }
    }
    return null;
  }

  function setActionsEnabled(enabled) {
    btnDownloadPng.disabled = !enabled;
    btnDownloadSvg.disabled = !enabled;
    btnDownloadVcf.disabled = !enabled;
    btnCopyVcard.disabled = !enabled;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getInitials(d, displayName) {
    if (d.firstName && d.lastName) {
      return (d.firstName[0] + d.lastName[0]).toUpperCase();
    }
    const clean = (displayName || 'C').replace(/[^a-zA-Z0-9\p{L}\s]/gu, '').trim();
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return (clean[0] || 'C').toUpperCase();
  }

  function formatHumanDate(isoStr) {
    if (!isoStr) return '';
    const m = isoStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return isoStr;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthName = months[parseInt(m[2], 10) - 1] || m[2];
    return `${monthName} ${parseInt(m[3], 10)}, ${m[1]}`;
  }

  function formatNameDayDisplay(parsed) {
    if (!parsed) return '';
    if (parsed.kind === 'full') return formatHumanDate(parsed.iso);
    if (parsed.kind === 'mmdd') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = months[parseInt(parsed.mm, 10) - 1] || parsed.mm;
      return `${monthName} ${parseInt(parsed.dd, 10)}`;
    }
    return parsed.raw;
  }

  function formatAddressLines(street, city, state, postcode, country) {
    const line1 = street;
    const regionPart = [state, postcode].filter(Boolean).join(' ');
    const line2 = [city, regionPart].filter(Boolean).join(', ');
    const line3 = country;
    return [line1, line2, line3].filter(Boolean);
  }

  function renderIosPreview(d, displayName, populatedCount) {
    const initials = escapeHtml(getInitials(d, displayName));
    const hasPhone = !!(d.mobilePhone || d.workPhone || d.homePhone);
    const hasEmail = !!(d.workEmail || d.privateEmail);
    const subtitle = [d.title, d.department, d.company].filter(Boolean).join(' · ');

    let html = `
      <div class="ios-navbar">
        <span>&#x2039; Contacts</span>
        <span>Edit</span>
      </div>
      <div class="ios-hero">
        <div class="ios-avatar">${initials}</div>
        <div class="ios-name">${escapeHtml(displayName)}</div>
        ${subtitle ? `<div class="ios-sub">${escapeHtml(subtitle)}</div>` : ''}
        ${d.nickname ? `<div class="ios-nickname">“${escapeHtml(d.nickname)}”</div>` : ''}
      </div>
      <div class="ios-actions">
        <div class="ios-act-btn ${hasPhone ? '' : 'is-muted'}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>
          <span>message</span>
        </div>
        <div class="ios-act-btn ${hasPhone ? '' : 'is-muted'}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24c1.1.36 2.3.56 3.6.56a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.6 21 3 13.4 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.3.2 2.5.56 3.6a1 1 0 0 1-.25 1l-2.21 2.2z"/></svg>
          <span>call</span>
        </div>
        <div class="ios-act-btn ${hasPhone || hasEmail ? '' : 'is-muted'}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>
          <span>video</span>
        </div>
        <div class="ios-act-btn ${hasEmail ? '' : 'is-muted'}">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/></svg>
          <span>mail</span>
        </div>
      </div>
    `;

    if (populatedCount === 0) {
      html += `<div class="phone-empty-note">Start typing on the left to see every field laid out on an iPhone contact card.</div>`;
      return html;
    }

    const phoneRows = [];
    if (d.mobilePhone) phoneRows.push(['mobile', d.mobilePhone]);
    if (d.workPhone) phoneRows.push(['work', d.workPhone]);
    if (d.homePhone) phoneRows.push(['home', d.homePhone]);
    if (d.mainPhone) phoneRows.push(['main', d.mainPhone]);
    if (d.workFax) phoneRows.push(['work fax', d.workFax]);
    if (d.homeFax) phoneRows.push(['home fax', d.homeFax]);
    if (d.pagerPhone) phoneRows.push(['pager', d.pagerPhone]);
    if (d.otherPhone) phoneRows.push(['other', d.otherPhone]);
    if (phoneRows.length) {
      html += `<div class="ios-group">${phoneRows.map(([l, v]) => `
        <div class="ios-row"><div class="ios-row-label">${escapeHtml(l)}</div><div class="ios-row-val">${escapeHtml(v)}</div></div>
      `).join('')}</div>`;
    }

    const emailRows = [];
    if (d.workEmail) emailRows.push(['work', d.workEmail]);
    if (d.privateEmail) emailRows.push(['home', d.privateEmail]);
    if (d.otherEmail) emailRows.push(['other', d.otherEmail]);
    if (emailRows.length) {
      html += `<div class="ios-group">${emailRows.map(([l, v]) => `
        <div class="ios-row"><div class="ios-row-label">${escapeHtml(l)}</div><div class="ios-row-val">${escapeHtml(v)}</div></div>
      `).join('')}</div>`;
    }

    const urlRows = [];
    if (d.workWebsite) urlRows.push(['work', escapeUrlValue(d.workWebsite)]);
    if (d.privateWebsite) urlRows.push(['home', escapeUrlValue(d.privateWebsite)]);
    if (urlRows.length) {
      html += `<div class="ios-group">${urlRows.map(([l, v]) => `
        <div class="ios-row"><div class="ios-row-label">${escapeHtml(l)}</div><div class="ios-row-val">${escapeHtml(v)}</div></div>
      `).join('')}</div>`;
    }

    const workAddr = formatAddressLines(d.workStreet, d.workCity, d.workState, d.workPostcode, d.workCountry);
    const privAddr = formatAddressLines(d.privateStreet, d.privateCity, d.privateState, d.privatePostcode, d.privateCountry);
    const otherAddr = formatAddressLines(d.otherStreet, d.otherCity, d.otherState, d.otherPostcode, d.otherCountry);
    if (workAddr.length || privAddr.length || otherAddr.length) {
      html += `<div class="ios-group">`;
      if (workAddr.length) {
        html += `<div class="ios-row"><div class="ios-row-label">work</div><div class="ios-row-val is-plain">${workAddr.map(escapeHtml).join('<br>')}</div></div>`;
      }
      if (privAddr.length) {
        html += `<div class="ios-row"><div class="ios-row-label">home</div><div class="ios-row-val is-plain">${privAddr.map(escapeHtml).join('<br>')}</div></div>`;
      }
      if (otherAddr.length) {
        html += `<div class="ios-row"><div class="ios-row-label">other</div><div class="ios-row-val is-plain">${otherAddr.map(escapeHtml).join('<br>')}</div></div>`;
      }
      html += `</div>`;
    }

    const workRows = [];
    if (d.company) workRows.push(['company', d.company]);
    if (d.department) workRows.push(['department', d.department]);
    if (d.title) workRows.push(['job title', d.title]);
    if (d.role) workRows.push(['role', d.role]);
    if (workRows.length) {
      html += `<div class="ios-group">${workRows.map(([l, v]) => `
        <div class="ios-row"><div class="ios-row-label">${escapeHtml(l)}</div><div class="ios-row-val is-plain">${escapeHtml(v)}</div></div>
      `).join('')}</div>`;
    }

    const phonetics = [d.phoneticFirstName, d.phoneticLastName].filter(Boolean).join(' ');
    if (phonetics) {
      html += `<div class="ios-group"><div class="ios-row"><div class="ios-row-label">pronunciation</div><div class="ios-row-val is-plain">${escapeHtml(phonetics)}</div></div></div>`;
    }

    const parsedNameDay = parseNameDay(d.nameDay);
    const nameDayInIosDate = parsedNameDay && parsedNameDay.kind !== 'text' && compatTarget !== 'android';
    const nameDayInNotes = parsedNameDay && parsedNameDay.kind === 'text';

    const dateRows = [];
    if (d.birthdate) dateRows.push(['birthday', formatHumanDate(d.birthdate)]);
    if (nameDayInIosDate) dateRows.push(['Name day', formatNameDayDisplay(parsedNameDay)]);
    if (dateRows.length) {
      html += `<div class="ios-group">${dateRows.map(([l, v]) => `
        <div class="ios-row"><div class="ios-row-label">${escapeHtml(l)}</div><div class="ios-row-val">${escapeHtml(v)}</div></div>
      `).join('')}</div>`;
    }

    const noteRows = [];
    if (d.notes) noteRows.push(d.notes);
    if (nameDayInNotes) noteRows.push(`Name day: ${parsedNameDay.raw}`);
    if (noteRows.length) {
      html += `<div class="ios-group"><div class="ios-row"><div class="ios-row-label">Notes</div><div class="ios-row-val is-plain">${escapeHtml(noteRows.join('\n\n'))}</div></div></div>`;
    }

    if (parsedNameDay && parsedNameDay.kind !== 'text' && compatTarget === 'android') {
      html += `<div class="phone-omitted-note">Phone target is set to <strong>Android</strong>; switch to <strong>Both</strong> or <strong>iPhone</strong> to include Name day for iOS.</div>`;
    }

    return html;
  }

  function renderAndroidPreview(d, displayName, populatedCount) {
    const iconUser = '<svg class="and-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    const iconPhone = '<svg class="and-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 11.2 18.8 19.5 19.5 0 0 1 5.2 12.8 19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6.2 6.2l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>';
    const iconWork = '<svg class="and-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>';
    const iconMail = '<svg class="and-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg>';
    const iconPin = '<svg class="and-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
    const iconCal = '<svg class="and-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
    const iconLink = '<svg class="and-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
    const iconNote = '<svg class="and-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
    const iconGroup = '<svg class="and-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
    const iconRelation = '<svg class="and-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    const iconPlus = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
    const iconChevronDown = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
    const iconChevronUp = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>';

    let html = `
      <div class="and-edit-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        <span class="and-edit-title">Create contact</span>
        <span class="and-save-btn">Save</span>
      </div>
    `;

    if (populatedCount === 0) {
      html += `<div class="phone-empty-note">Start typing on the left to see how Android Google Contacts lays out every field when importing this contact.</div>`;
      return html;
    }

    // Card 1: Name fields (Structured expanded)
    const nameLines = [];
    if (d.prefix) nameLines.push(d.prefix);
    if (d.firstName) nameLines.push(d.firstName);
    if (d.middleName) nameLines.push(d.middleName);
    if (d.lastName) nameLines.push(d.lastName);
    if (d.nameSuffix) nameLines.push(d.nameSuffix);
    if (d.phoneticFirstName) nameLines.push(`Phonetic: ${d.phoneticFirstName}`);
    if (d.phoneticLastName) nameLines.push(`Phonetic: ${d.phoneticLastName}`);

    if (nameLines.length) {
      html += `
        <div class="and-edit-card">
          <div class="and-card-row">
            ${iconUser}
            <div class="and-card-fields">
              ${nameLines.map((v) => `
                <div class="and-input-line">
                  <div class="and-input-val">${escapeHtml(v)}</div>
                </div>
              `).join('')}
            </div>
            <div class="and-card-top-action">${iconChevronUp}</div>
          </div>
        </div>
      `;
    }

    // Card 2: Nickname
    if (d.nickname) {
      html += `
        <div class="and-edit-card">
          <div class="and-card-row">
            ${iconUser}
            <div class="and-card-fields">
              <div class="and-input-line">
                <div class="and-input-val">${escapeHtml(d.nickname)}</div>
                <div class="and-del-badge"></div>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    // Card 3: Phones
    const phones = [];
    if (d.mobilePhone) phones.push(['Mobile', d.mobilePhone]);
    if (d.workPhone) phones.push(['Work', d.workPhone]);
    if (d.homePhone) phones.push(['Home', d.homePhone]);
    if (d.mainPhone) phones.push(['Main', d.mainPhone]);
    if (d.workFax) phones.push(['Work fax', d.workFax]);
    if (d.homeFax) phones.push(['Home fax', d.homeFax]);
    if (d.pagerPhone) phones.push(['Pager', d.pagerPhone]);
    if (d.otherPhone) phones.push(['Other', d.otherPhone]);

    if (phones.length) {
      html += `
        <div class="and-edit-card">
          <div class="and-card-row">
            ${iconPhone}
            <div class="and-card-fields">
              ${phones.map(([lbl, val]) => `
                <div class="and-input-line">
                  <div style="flex:1">
                    <div class="and-input-label-tag">${escapeHtml(lbl)} ${iconChevronDown}</div>
                    <div class="and-input-val">${escapeHtml(val)}</div>
                  </div>
                  <div class="and-del-badge"></div>
                </div>
              `).join('')}
              <div class="and-add-more-row">${iconPlus} Add phone number</div>
            </div>
          </div>
        </div>
      `;
    }

    // Card 4: Work details (Title, Role, Department, Company)
    const workItems = [d.title, d.role, d.department, d.company].filter(Boolean);
    if (workItems.length) {
      html += `
        <div class="and-edit-card">
          <div class="and-card-row">
            ${iconWork}
            <div class="and-card-fields">
              ${workItems.map((val, idx) => `
                <div class="and-input-line">
                  <div class="and-input-val">${escapeHtml(val)}</div>
                  ${idx === 0 ? '<div class="and-del-badge"></div>' : ''}
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    // Card 5: Emails
    const emails = [];
    if (d.workEmail) emails.push(['Work', d.workEmail]);
    if (d.privateEmail) emails.push(['Home', d.privateEmail]);
    if (d.otherEmail) emails.push(['Other', d.otherEmail]);

    if (emails.length) {
      html += `
        <div class="and-edit-card">
          <div class="and-card-row">
            ${iconMail}
            <div class="and-card-fields">
              ${emails.map(([lbl, val]) => `
                <div class="and-input-line">
                  <div style="flex:1">
                    <div class="and-input-label-tag">${escapeHtml(lbl)} ${iconChevronDown}</div>
                    <div class="and-input-val">${escapeHtml(val)}</div>
                  </div>
                  <div class="and-del-badge"></div>
                </div>
              `).join('')}
              <div class="and-add-more-row">${iconPlus} Add email</div>
            </div>
          </div>
        </div>
      `;
    }

    // Card 6: Addresses (Work, Home, Other)
    const addresses = [];
    if (d.workStreet || d.workCity || d.workState || d.workPostcode || d.workCountry) {
      addresses.push(['Work', [d.workStreet, d.workCity, d.workState, d.workPostcode, d.workCountry]]);
    }
    if (d.privateStreet || d.privateCity || d.privateState || d.privatePostcode || d.privateCountry) {
      addresses.push(['Home', [d.privateStreet, d.privateCity, d.privateState, d.privatePostcode, d.privateCountry]]);
    }
    if (d.otherStreet || d.otherCity || d.otherState || d.otherPostcode || d.otherCountry) {
      addresses.push(['Other', [d.otherStreet, d.otherCity, d.otherState, d.otherPostcode, d.otherCountry]]);
    }

    if (addresses.length) {
      html += `
        <div class="and-edit-card">
          <div class="and-card-row">
            ${iconPin}
            <div class="and-card-fields">
              ${addresses.map(([lbl, lines]) => `
                <div class="and-input-line" style="flex-direction:column;align-items:flex-start">
                  <div style="display:flex;align-items:center;width:100%">
                    <div class="and-input-label-tag">${escapeHtml(lbl)} ${iconChevronDown}</div>
                    <div class="and-del-badge"></div>
                  </div>
                  ${lines.filter(Boolean).map((ln) => `
                    <div class="and-input-line" style="width:100%;padding:3px 0">
                      <div class="and-input-val">${escapeHtml(ln)}</div>
                    </div>
                  `).join('')}
                </div>
              `).join('')}
              <div class="and-add-more-row">${iconPlus} Add address</div>
            </div>
          </div>
        </div>
      `;
    }

    // Card 7: Important dates (Birthday & Name day)
    const parsedNameDay = parseNameDay(d.nameDay);
    const dateEntries = [];
    if (d.birthdate) {
      dateEntries.push(['Birthday', formatHumanDate(d.birthdate)]);
    }
    if (parsedNameDay && parsedNameDay.kind !== 'text' && compatTarget !== 'iphone') {
      dateEntries.push(['Name day', formatNameDayDisplay(parsedNameDay)]);
    }

    if (dateEntries.length) {
      html += `
        <div class="and-edit-card">
          <div class="and-card-row">
            ${iconCal}
            <div class="and-card-fields">
              ${dateEntries.map(([lbl, val]) => `
                <div class="and-input-line">
                  <div style="flex:1">
                    <div class="and-input-label-tag">${escapeHtml(lbl)} ${iconChevronDown}</div>
                    <div class="and-input-val" style="margin-top:2px;display:inline-block;padding:2px 10px;background:#2a2b2f;border-radius:12px">${escapeHtml(val)}</div>
                  </div>
                  <div class="and-del-badge"></div>
                </div>
              `).join('')}
              <div class="and-add-more-row">${iconPlus} Add important date</div>
            </div>
          </div>
        </div>
      `;
    }

    // Collapsed Groups bar
    html += `
      <div class="and-collapsed-section">
        ${iconGroup}
        <span>Groups</span>
      </div>
    `;

    // Card 8: Websites
    const websites = [];
    if (d.workWebsite) websites.push(escapeUrlValue(d.workWebsite));
    if (d.privateWebsite) websites.push(escapeUrlValue(d.privateWebsite));

    if (websites.length) {
      html += `
        <div class="and-edit-card">
          <div class="and-card-row">
            ${iconLink}
            <div class="and-card-fields">
              ${websites.map((url) => `
                <div class="and-input-line">
                  <div class="and-input-val">${escapeHtml(url)}</div>
                  <div class="and-del-badge"></div>
                </div>
              `).join('')}
              <div class="and-add-more-row">${iconPlus} Add website</div>
            </div>
          </div>
        </div>
      `;
    }

    // Collapsed Relationships bar
    html += `
      <div class="and-collapsed-section">
        ${iconRelation}
        <span>Relationships</span>
      </div>
    `;

    // Card 9: Notes
    if (d.notes || (parsedNameDay && parsedNameDay.kind === 'text')) {
      const allNotes = [d.notes, (parsedNameDay && parsedNameDay.kind === 'text' ? `Name day: ${parsedNameDay.raw}` : '')].filter(Boolean).join('\n\n');
      html += `
        <div class="and-edit-card">
          <div class="and-card-row">
            ${iconNote}
            <div class="and-card-fields">
              <div class="and-input-line">
                <div class="and-input-val">${escapeHtml(allNotes)}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="and-collapsed-section">
          ${iconNote}
          <span>Notes</span>
        </div>
      `;
    }

    if (parsedNameDay && parsedNameDay.kind !== 'text' && compatTarget === 'iphone') {
      html += `<div class="phone-omitted-note">Phone target is set to <strong>iPhone</strong>; switch to <strong>Both</strong> or <strong>Android</strong> to include Name day for Android.</div>`;
    }

    return html;
  }

  function renderPhonePreview(d, displayName, populatedCount) {
    if (!phoneFrame || !phoneScreen) return;
    phoneFrame.dataset.os = previewOs;
    if (sbTime) {
      sbTime.textContent = previewOs === 'iphone' ? '9:41' : '12:00';
    }
    phoneScreen.innerHTML = previewOs === 'iphone'
      ? renderIosPreview(d, displayName, populatedCount)
      : renderAndroidPreview(d, displayName, populatedCount);
  }

  function applyValues(data) {
    for (const id of FIELD_IDS) {
      const el = document.getElementById(id);
      if (el) {
        el.value = (data && typeof data[id] === 'string') ? data[id] : '';
      }
    }
    nameDayPicker.value = '';
  }

  function loadSavedList() {
    try {
      const raw = localStorage.getItem(SAVED_LIST_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function saveSavedList(list) {
    try {
      localStorage.setItem(SAVED_LIST_KEY, JSON.stringify(list));
    } catch (_) {
      // Ignore storage errors
    }
  }

  function renderSavedSelect(selectedId = '') {
    if (!savedContactsSelect) return;
    const list = loadSavedList();
    savedContactsSelect.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = `Saved contacts (${list.length})`;
    savedContactsSelect.appendChild(placeholder);

    for (const item of list) {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.label;
      if (item.id === selectedId) opt.selected = true;
      savedContactsSelect.appendChild(opt);
    }

    if (btnDeleteContact) {
      btnDeleteContact.disabled = !savedContactsSelect.value;
    }
  }

  function saveCurrentContact() {
    const data = getValues();
    const populatedCount = FIELD_IDS.reduce((acc, id) => acc + (data[id] ? 1 : 0), 0);
    if (populatedCount === 0) return;

    const displayName = buildDisplayName(data);
    const label = (data.company && displayName !== data.company)
      ? `${displayName} (${data.company})`
      : displayName;

    const list = loadSavedList();
    const currentId = savedContactsSelect ? savedContactsSelect.value : '';
    let targetItem = currentId ? list.find((x) => x.id === currentId) : null;
    if (!targetItem) {
      targetItem = list.find((x) => x.label.toLowerCase() === label.toLowerCase());
    }

    if (targetItem) {
      targetItem.label = label;
      targetItem.data = data;
      targetItem.updatedAt = Date.now();
    } else {
      targetItem = {
        id: `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        label,
        data,
        updatedAt: Date.now()
      };
      list.unshift(targetItem);
    }

    saveSavedList(list);
    renderSavedSelect(targetItem.id);

    const origHtml = btnSaveContact.innerHTML;
    btnSaveContact.textContent = 'Saved!';
    setTimeout(() => {
      btnSaveContact.innerHTML = origHtml;
    }, 1400);
  }

  function deleteSelectedContact() {
    if (!savedContactsSelect || !savedContactsSelect.value) return;
    const idToDelete = savedContactsSelect.value;
    const list = loadSavedList().filter((x) => x.id !== idToDelete);
    saveSavedList(list);
    renderSavedSelect('');
  }

  function unescapeVCardValue(val) {
    return String(val)
      .replace(/\\n/gi, '\n')
      .replace(/\\;/g, ';')
      .replace(/\\,/g, ',')
      .replace(/\\\\/g, '\\');
  }

  function splitUnescapedSemicolons(str) {
    const parts = [];
    let current = '';
    for (let i = 0; i < str.length; i += 1) {
      const ch = str[i];
      if (ch === '\\' && i + 1 < str.length) {
        current += ch + str[i + 1];
        i += 1;
      } else if (ch === ';') {
        parts.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    parts.push(current);
    return parts;
  }

  function normalizeImportedDate(val) {
    const v = val.trim();
    const compact = v.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
    const iso = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
    return v;
  }

  function normalizeImportedNameDay(rawDate) {
    const v = rawDate.trim();
    const appleYearless = v.match(/^1604-(\d{2})-(\d{2})$/);
    if (appleYearless) return `${appleYearless[1]}-${appleYearless[2]}`;
    const androidYearless = v.match(/^--(\d{2})-(\d{2})$/);
    if (androidYearless) return `${androidYearless[1]}-${androidYearless[2]}`;
    return normalizeImportedDate(v);
  }

  function parseVCard(vcfText) {
    const out = {};
    for (const id of FIELD_IDS) out[id] = '';

    // Unfold RFC 2426 continuation lines
    const unfolded = String(vcfText)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n[ \t]/g, '');

    const rawLines = unfolded.split('\n').filter((l) => l.trim().length > 0);

    // Collect Apple itemN groups so itemN.URL / itemN.X-ABDATE pair with itemN.X-ABLabel
    const itemGroups = {};
    const parsedEntries = [];

    for (const line of rawLines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const left = line.slice(0, colonIdx);
      const value = line.slice(colonIdx + 1);

      const semiIdx = left.indexOf(';');
      const rawKey = (semiIdx === -1 ? left : left.slice(0, semiIdx)).trim();
      const paramStr = semiIdx === -1 ? '' : left.slice(semiIdx + 1);
      const paramsUpper = paramStr.toUpperCase();

      const dotIdx = rawKey.indexOf('.');
      const groupName = dotIdx === -1 ? '' : rawKey.slice(0, dotIdx).toLowerCase();
      const propName = (dotIdx === -1 ? rawKey : rawKey.slice(dotIdx + 1)).toUpperCase();

      if (groupName) {
        if (!itemGroups[groupName]) itemGroups[groupName] = {};
        if (propName === 'X-ABLABEL') {
          itemGroups[groupName].label = unescapeVCardValue(value).trim();
        } else {
          itemGroups[groupName][propName] = value;
        }
      }

      parsedEntries.push({ groupName, propName, paramsUpper, value });
    }

    let fallbackFn = '';

    for (const entry of parsedEntries) {
      const { groupName, propName, paramsUpper, value } = entry;

      if (propName === 'N') {
        const parts = splitUnescapedSemicolons(value).map(unescapeVCardValue);
        out.lastName = parts[0] || '';
        out.firstName = parts[1] || '';
        out.middleName = parts[2] || '';
        out.prefix = parts[3] || '';
        out.nameSuffix = parts[4] || '';
      } else if (propName === 'FN') {
        fallbackFn = unescapeVCardValue(value).trim();
      } else if (propName === 'NICKNAME') {
        out.nickname = unescapeVCardValue(value).trim();
      } else if (propName === 'TITLE') {
        out.title = unescapeVCardValue(value).trim();
      } else if (propName === 'ROLE') {
        out.role = unescapeVCardValue(value).trim();
      } else if (propName === 'X-PHONETIC-FIRST-NAME') {
        out.phoneticFirstName = unescapeVCardValue(value).trim();
      } else if (propName === 'X-PHONETIC-LAST-NAME') {
        out.phoneticLastName = unescapeVCardValue(value).trim();
      } else if (propName === 'ORG') {
        const parts = splitUnescapedSemicolons(value).map(unescapeVCardValue);
        out.company = parts[0] || '';
        out.department = parts[1] || '';
      } else if (propName === 'TEL') {
        const cleanTel = unescapeVCardValue(value).trim();
        if (paramsUpper.includes('PAGER')) {
          if (!out.pagerPhone) out.pagerPhone = cleanTel;
        } else if (paramsUpper.includes('FAX')) {
          if (paramsUpper.includes('HOME')) {
            if (!out.homeFax) out.homeFax = cleanTel;
          } else {
            if (!out.workFax) out.workFax = cleanTel;
          }
        } else if (paramsUpper.includes('MAIN')) {
          if (!out.mainPhone) out.mainPhone = cleanTel;
        } else if (paramsUpper.includes('CELL')) {
          if (!out.mobilePhone) out.mobilePhone = cleanTel;
        } else if (paramsUpper.includes('WORK')) {
          if (!out.workPhone) out.workPhone = cleanTel;
        } else if (paramsUpper.includes('HOME')) {
          if (!out.homePhone) out.homePhone = cleanTel;
        } else {
          if (!out.otherPhone) out.otherPhone = cleanTel;
        }
      } else if (propName === 'EMAIL') {
        const cleanMail = unescapeVCardValue(value).trim();
        if (paramsUpper.includes('WORK')) {
          if (!out.workEmail) out.workEmail = cleanMail;
        } else if (paramsUpper.includes('HOME')) {
          if (!out.privateEmail) out.privateEmail = cleanMail;
        } else if (paramsUpper.includes('OTHER')) {
          if (!out.otherEmail) out.otherEmail = cleanMail;
        } else if (!out.workEmail) {
          out.workEmail = cleanMail;
        } else if (!out.privateEmail) {
          out.privateEmail = cleanMail;
        } else if (!out.otherEmail) {
          out.otherEmail = cleanMail;
        }
      } else if (propName === 'ADR') {
        const parts = splitUnescapedSemicolons(value).map(unescapeVCardValue);
        const street = parts[2] || '';
        const city = parts[3] || '';
        const state = parts[4] || '';
        const postcode = parts[5] || '';
        const country = parts[6] || '';
        if (paramsUpper.includes('HOME')) {
          out.privateStreet = street;
          out.privateCity = city;
          out.privateState = state;
          out.privatePostcode = postcode;
          out.privateCountry = country;
        } else if (paramsUpper.includes('OTHER')) {
          out.otherStreet = street;
          out.otherCity = city;
          out.otherState = state;
          out.otherPostcode = postcode;
          out.otherCountry = country;
        } else {
          // WORK or untyped ADR defaults to work address if empty
          if (!out.workStreet && !out.workCity && !out.workCountry) {
            out.workStreet = street;
            out.workCity = city;
            out.workState = state;
            out.workPostcode = postcode;
            out.workCountry = country;
          } else if (!out.privateStreet && !out.privateCity) {
            out.privateStreet = street;
            out.privateCity = city;
            out.privateState = state;
            out.privatePostcode = postcode;
            out.privateCountry = country;
          } else if (!out.otherStreet && !out.otherCity) {
            out.otherStreet = street;
            out.otherCity = city;
            out.otherState = state;
            out.otherPostcode = postcode;
            out.otherCountry = country;
          }
        }
      } else if (propName === 'BDAY') {
        out.birthdate = normalizeImportedDate(value);
      } else if (propName === 'URL') {
        const cleanUrl = unescapeVCardValue(value).trim();
        const grpLabel = (groupName && itemGroups[groupName] && itemGroups[groupName].label)
          ? itemGroups[groupName].label.toUpperCase()
          : '';
        if (paramsUpper.includes('WORK') || grpLabel.includes('WORK')) {
          if (!out.workWebsite) out.workWebsite = cleanUrl;
        } else if (paramsUpper.includes('HOME') || grpLabel.includes('HOME')) {
          if (!out.privateWebsite) out.privateWebsite = cleanUrl;
        } else if (!out.workWebsite) {
          out.workWebsite = cleanUrl;
        } else if (!out.privateWebsite) {
          out.privateWebsite = cleanUrl;
        }
      } else if (propName === 'X-ABDATE') {
        const grpLabel = (groupName && itemGroups[groupName] && itemGroups[groupName].label)
          ? itemGroups[groupName].label.toLowerCase()
          : '';
        if (!out.nameDay && (!grpLabel || grpLabel.includes('name day'))) {
          out.nameDay = normalizeImportedNameDay(value);
        }
      } else if (propName === 'X-ANDROID-CUSTOM') {
        const parts = splitUnescapedSemicolons(value);
        if (parts[0] && parts[0].includes('contact_event') && parts[1]) {
          if (!out.nameDay) out.nameDay = normalizeImportedNameDay(parts[1]);
        }
      } else if (propName === 'NOTE') {
        const noteText = unescapeVCardValue(value).trim();
        const m = noteText.match(/^Name day:\s*(.+)$/i);
        if (m && !out.nameDay) {
          out.nameDay = m[1].trim();
        } else {
          out.notes = out.notes ? `${out.notes}\n${noteText}` : noteText;
        }
      }
    }

    // If external vCard only had FN without N, put FN into firstName/lastName cleanly
    if (!out.firstName && !out.lastName && fallbackFn) {
      const tokens = fallbackFn.split(/\s+/).filter(Boolean);
      if (tokens.length === 1) {
        out.firstName = tokens[0];
      } else if (tokens.length >= 2) {
        out.firstName = tokens.slice(0, -1).join(' ');
        out.lastName = tokens[tokens.length - 1];
      }
    }

    return out;
  }

  function importVcfText(vcfText) {
    const parsed = parseVCard(vcfText);
    applyValues(parsed);
    if (savedContactsSelect) {
      savedContactsSelect.value = '';
      if (btnDeleteContact) btnDeleteContact.disabled = true;
    }
    update();
  }

  function saveToLocalStorage(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data, compatTarget, previewOs }));
    } catch (_) {
      // Ignore storage errors (e.g., private browsing restrictions)
    }
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.data) {
        applyValues(parsed.data);
      }
      if (parsed && ['both', 'iphone', 'android'].includes(parsed.compatTarget)) {
        compatTarget = parsed.compatTarget;
        segButtons.forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.target === compatTarget);
        });
      }
      if (parsed && ['iphone', 'android'].includes(parsed.previewOs)) {
        previewOs = parsed.previewOs;
        osButtons.forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.os === previewOs);
        });
      }
    } catch (_) {
      // Ignore malformed storage
    }
  }

  function update() {
    const data = getValues();
    const populatedCount = FIELD_IDS.reduce((acc, id) => acc + (data[id] ? 1 : 0), 0);

    saveToLocalStorage(data);

    if (btnSaveContact) {
      btnSaveContact.disabled = populatedCount === 0;
    }

    if (populatedCount === 0) {
      currentQr = null;
      currentVCard = '';
      currentDisplayName = 'New Contact';

      qrEmpty.hidden = false;
      qrOutput.hidden = true;
      qrOutput.innerHTML = '';

      statusPill.textContent = 'Empty';
      statusPill.className = 'status-pill status-empty';

      summaryName.textContent = 'New Contact';
      summaryMeta.textContent = '0 fields populated';
      metricBytes.textContent = '0 bytes';
      metricVersion.textContent = 'vCard 3.0';
      metricEcc.textContent = 'ECC M';

      setActionsEnabled(false);
      renderPhonePreview(data, currentDisplayName, 0);
      return;
    }

    currentDisplayName = buildDisplayName(data);
    currentVCard = buildVCard(data, compatTarget);
    const bytes = utf8ByteLength(currentVCard);

    const roleCompany = [data.title, data.company].filter(Boolean).join(' · ');
    summaryName.textContent = currentDisplayName;
    summaryMeta.textContent = roleCompany
      ? `${roleCompany} (${populatedCount} field${populatedCount === 1 ? '' : 's'})`
      : `${populatedCount} field${populatedCount === 1 ? '' : 's'} populated`;

    renderPhonePreview(data, currentDisplayName, populatedCount);

    const result = generateQr(currentVCard);
    if (!result) {
      currentQr = null;
      qrEmpty.hidden = false;
      qrOutput.hidden = true;
      qrOutput.innerHTML = '';
      statusPill.textContent = 'Too large';
      statusPill.className = 'status-pill status-error';
      metricBytes.textContent = `${bytes} bytes (max ~2953)`;
      setActionsEnabled(false);
      return;
    }

    currentQr = result.qr;
    const moduleCount = currentQr.getModuleCount();
    const qrVersion = Math.round((moduleCount - 17) / 4);

    qrOutput.innerHTML = currentQr.createSvgTag({
      cellSize: 4,
      margin: 16,
      scalable: true,
      title: `Contact QR code for ${currentDisplayName}`
    });
    qrEmpty.hidden = true;
    qrOutput.hidden = false;

    if (qrVersion >= 22) {
      statusPill.textContent = 'Dense';
      statusPill.className = 'status-pill status-warn';
    } else {
      statusPill.textContent = 'Ready';
      statusPill.className = 'status-pill status-ready';
    }

    metricBytes.textContent = `${bytes} bytes`;
    metricVersion.textContent = `QR v${qrVersion} (${moduleCount}×${moduleCount})`;
    metricEcc.textContent = `ECC ${result.ecc}`;

    setActionsEnabled(true);
  }

  function sanitizedFileBase() {
    const base = currentDisplayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '');
    return base || 'contact';
  }

  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadPng() {
    if (!currentQr) return;
    const count = currentQr.getModuleCount();
    const quietModules = 4;
    const totalModules = count + quietModules * 2;
    const targetPx = 1024;
    const cellSize = Math.max(4, Math.floor(targetPx / totalModules));
    const canvasSize = cellSize * totalModules;

    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    ctx.fillStyle = '#000000';
    for (let r = 0; r < count; r += 1) {
      for (let c = 0; c < count; c += 1) {
        if (currentQr.isDark(r, c)) {
          ctx.fillRect(
            (c + quietModules) * cellSize,
            (r + quietModules) * cellSize,
            cellSize,
            cellSize
          );
        }
      }
    }

    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, `${sanitizedFileBase()}-qr.png`);
    }, 'image/png');
  }

  function downloadSvg() {
    if (!currentQr) return;
    const svg = currentQr.createSvgTag({
      cellSize: 8,
      margin: 32,
      scalable: false,
      title: `Contact QR code for ${currentDisplayName}`
    });
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(blob, `${sanitizedFileBase()}-qr.svg`);
  }

  function downloadVcf() {
    if (!currentVCard) return;
    const blob = new Blob([currentVCard], { type: 'text/vcard;charset=utf-8' });
    triggerDownload(blob, `${sanitizedFileBase()}.vcf`);
  }

  async function copyText(text, buttonEl, defaultLabel) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      // Fallback for restricted file:// contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    const prev = buttonEl.textContent;
    buttonEl.textContent = 'Copied!';
    setTimeout(() => {
      buttonEl.textContent = defaultLabel || prev;
    }, 1500);
  }

  // Event listeners
  form.addEventListener('input', update);

  // Sync optional calendar date picker to Name day text input
  nameDayPicker.addEventListener('change', () => {
    if (nameDayPicker.value) {
      nameDayInput.value = nameDayPicker.value;
      update();
    }
  });

  segButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      compatTarget = btn.dataset.target;
      segButtons.forEach((b) => b.classList.toggle('active', b === btn));
      if (compatTarget === 'iphone' || compatTarget === 'android') {
        previewOs = compatTarget;
        osButtons.forEach((b) => b.classList.toggle('active', b.dataset.os === previewOs));
      }
      update();
    });
  });

  osButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      previewOs = btn.dataset.os;
      osButtons.forEach((b) => b.classList.toggle('active', b === btn));
      update();
    });
  });

  btnSample.addEventListener('click', () => {
    applyValues(SAMPLE_DATA);
    if (savedContactsSelect) savedContactsSelect.value = '';
    if (btnDeleteContact) btnDeleteContact.disabled = true;
    update();
  });

  btnClear.addEventListener('click', () => {
    applyValues({});
    if (savedContactsSelect) savedContactsSelect.value = '';
    if (btnDeleteContact) btnDeleteContact.disabled = true;
    update();
  });

  if (btnSaveContact) {
    btnSaveContact.addEventListener('click', saveCurrentContact);
  }

  if (btnDeleteContact) {
    btnDeleteContact.addEventListener('click', deleteSelectedContact);
  }

  if (savedContactsSelect) {
    savedContactsSelect.addEventListener('change', () => {
      const selectedId = savedContactsSelect.value;
      if (btnDeleteContact) btnDeleteContact.disabled = !selectedId;
      if (!selectedId) return;
      const item = loadSavedList().find((x) => x.id === selectedId);
      if (item && item.data) {
        applyValues(item.data);
        update();
      }
    });
  }

  if (btnLoadVcf && vcfFileInput) {
    btnLoadVcf.addEventListener('click', () => {
      vcfFileInput.value = '';
      vcfFileInput.click();
    });

    vcfFileInput.addEventListener('change', () => {
      const file = vcfFileInput.files && vcfFileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          importVcfText(reader.result);
        }
      };
      reader.readAsText(file, 'utf-8');
    });
  }

  btnCopyAddress.addEventListener('click', () => {
    const map = [
      ['workStreet', 'privateStreet'],
      ['workCity', 'privateCity'],
      ['workState', 'privateState'],
      ['workPostcode', 'privatePostcode'],
      ['workCountry', 'privateCountry']
    ];
    for (const [src, dst] of map) {
      document.getElementById(dst).value = document.getElementById(src).value;
    }
    update();
  });

  btnDownloadPng.addEventListener('click', downloadPng);
  btnDownloadSvg.addEventListener('click', downloadSvg);
  btnDownloadVcf.addEventListener('click', downloadVcf);
  btnCopyVcard.addEventListener('click', () => copyText(currentVCard, btnCopyVcard, 'Copy vCard'));

  btnViewVcard.addEventListener('click', () => {
    vcardRaw.textContent = currentVCard || 'Fill in at least one field to preview the generated vCard 3.0 payload.';
    if (typeof vcardModal.showModal === 'function') {
      vcardModal.showModal();
    } else {
      vcardModal.setAttribute('open', '');
    }
  });

  const closeModal = () => {
    if (typeof vcardModal.close === 'function') {
      vcardModal.close();
    } else {
      vcardModal.removeAttribute('open');
    }
  };

  btnCloseModal.addEventListener('click', closeModal);
  btnModalClose.addEventListener('click', closeModal);
  vcardModal.addEventListener('click', (e) => {
    if (e.target === vcardModal) closeModal();
  });
  btnModalCopy.addEventListener('click', () => copyText(currentVCard, btnModalCopy, 'Copy text'));

  // ═══════════════════════════════════════════════════════
  // UI THEME (App dark/light mode)
  // ═══════════════════════════════════════════════════════
  const PREVIEW_THEME_KEY = 'contact_qr_preview_theme_v1';
  const VIEW_MODE_KEY = 'contact_qr_view_mode_v1';

  const btnThemeUi = document.getElementById('btn-theme-ui');
  const btnThemePreview = document.getElementById('btn-theme-preview');
  const btnThemeBoth = document.getElementById('btn-theme-both');
  const uiThemeLabel = document.getElementById('ui-theme-label');
  const previewThemeLabel = document.getElementById('preview-theme-label');
  const previewThemeBtns = Array.from(document.querySelectorAll('.preview-theme-btn'));

  function applyUiTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (uiThemeLabel) uiThemeLabel.textContent = theme === 'dark' ? 'Light' : 'Dark';
    try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch (_) {}
  }

  function applyPreviewTheme(theme) {
    if (phoneFrame) phoneFrame.setAttribute('data-preview-theme', theme);
    if (previewThemeLabel) previewThemeLabel.textContent = theme === 'dark' ? 'Light' : 'Dark';
    // sync the Light/Dark segmented buttons in the preview head
    previewThemeBtns.forEach(b => b.classList.toggle('active', b.dataset.prevTheme === theme));
    try { localStorage.setItem(PREVIEW_THEME_KEY, theme); } catch (_) {}
  }

  function getUiTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function getPreviewTheme() {
    return (phoneFrame && phoneFrame.getAttribute('data-preview-theme') === 'dark') ? 'dark' : 'light';
  }

  function initTheme() {
    // UI theme
    let savedUi = '';
    try { savedUi = localStorage.getItem(THEME_STORAGE_KEY) || ''; } catch (_) {}
    if (!savedUi) savedUi = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyUiTheme(savedUi);

    // Preview theme (default: light)
    let savedPreview = '';
    try { savedPreview = localStorage.getItem(PREVIEW_THEME_KEY) || ''; } catch (_) {}
    if (!savedPreview) savedPreview = 'light';
    applyPreviewTheme(savedPreview);

    // Wire buttons
    if (btnThemeUi) {
      btnThemeUi.addEventListener('click', () => applyUiTheme(getUiTheme() === 'dark' ? 'light' : 'dark'));
    }
    if (btnThemePreview) {
      btnThemePreview.addEventListener('click', () => applyPreviewTheme(getPreviewTheme() === 'dark' ? 'light' : 'dark'));
    }
    if (btnThemeBoth) {
      btnThemeBoth.addEventListener('click', () => {
        const next = getUiTheme() === 'dark' ? 'light' : 'dark';
        applyUiTheme(next);
        applyPreviewTheme(next);
      });
    }

    // Preview segmented Light / Dark buttons inside the preview card
    previewThemeBtns.forEach(btn => {
      btn.addEventListener('click', () => applyPreviewTheme(btn.dataset.prevTheme));
    });
  }

  // ═══════════════════════════════════════════════════════
  // VIEW MODE (Simple / Advanced)
  // ═══════════════════════════════════════════════════════
  const modeBtns = Array.from(document.querySelectorAll('.mode-btn'));

  function applyViewMode(mode) {
    document.body.setAttribute('data-view-mode', mode);
    modeBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    try { localStorage.setItem(VIEW_MODE_KEY, mode); } catch (_) {}
  }

  function initViewMode() {
    let saved = '';
    try { saved = localStorage.getItem(VIEW_MODE_KEY) || ''; } catch (_) {}
    applyViewMode(saved === 'advanced' ? 'advanced' : 'simple');
    modeBtns.forEach(btn => {
      btn.addEventListener('click', () => applyViewMode(btn.dataset.mode));
    });
  }

  // PWA Service Worker & Install Prompt Handling
  function initPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
          console.warn('PWA service worker registration failed:', err);
        });
      });
    }

    const btnInstallPwa = document.getElementById('btn-install-pwa');
    let deferredPrompt = null;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (btnInstallPwa) {
        btnInstallPwa.removeAttribute('hidden');
      }
    });

    if (btnInstallPwa) {
      btnInstallPwa.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          btnInstallPwa.setAttribute('hidden', '');
        }
        deferredPrompt = null;
      });
    }

    window.addEventListener('appinstalled', () => {
      if (btnInstallPwa) {
        btnInstallPwa.setAttribute('hidden', '');
      }
    });
  }

  // Initialize
  initPWA();
  initTheme();
  initViewMode();
  renderSavedSelect('');
  loadFromLocalStorage();
  update();
})();
