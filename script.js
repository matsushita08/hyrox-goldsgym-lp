// Always start new visits at the hero, even if an old section hash remains in the URL.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function resetInitialScroll() {
  if (window.location.hash) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
}

window.addEventListener('DOMContentLoaded', resetInitialScroll, { once: true });
window.addEventListener('load', resetInitialScroll, { once: true });

// header scroll effect
window.addEventListener('scroll', () => {
  document.getElementById('site-header').classList.toggle('scrolled', window.scrollY > 40);
});

function smoothTo(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}


function showStore(storeId) {
  document.querySelectorAll('.pricing-table').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const table = document.getElementById('store-' + storeId);
  if (table) table.classList.add('active');
  const activeTab = document.querySelector(`.tab-btn[onclick*="'${storeId}'"]`);
  if (activeTab) activeTab.classList.add('active');
  const select = document.getElementById('pricing-store-select');
  if (select) select.value = storeId;
}

function syncRaceFlowMobileState() {
  const raceMap = document.querySelector('.race-map');
  if (!raceMap) return;
  if (window.matchMedia('(max-width: 768px)').matches) {
    raceMap.removeAttribute('open');
  } else {
    raceMap.setAttribute('open', '');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  syncRaceFlowMobileState();
  const raceFlowQuery = window.matchMedia('(max-width: 768px)');
  raceFlowQuery.addEventListener('change', syncRaceFlowMobileState);
});

function toggleFaq(btn) {
  btn.classList.toggle('open');
  const answer = btn.nextElementSibling;
  answer.classList.toggle('open');
}

function openLightbox(src, alt) {
  const lightbox = document.getElementById('lightbox');
  const image = document.getElementById('lightbox-img');
  image.src = src;
  image.alt = alt || '';
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lightbox = document.getElementById('lightbox');
  const image = document.getElementById('lightbox-img');
  lightbox.classList.remove('open');
  image.src = '';
  image.alt = '';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeLightbox();
    closeRuleModal();
  }
});

const raceMap = document.querySelector('.race-map');
if (raceMap) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  observer.observe(raceMap);
}

const ruleDetails = {
  'skierg': {
    title: '01 SkiErg',
    subtitle: 'スキーエルゴ',
    image: 'assets/rules/pop/skierg.png',
    pop: 'assets/rules/pop/skierg.png',
    page: 1,
    pdf: 'assets/rules/events/01-skierg.pdf',
    specs: [
      ['距離', '1,000m'],
      ['女性', '---'],
      ['男性', '---'],
      ['WOMEN PRO', '---'],
      ['MEN PRO', '---']
    ],
    rules: [
      '動作中は両足を常にスキーエルゴのプラットフォーム上に置く。',
      'ダンパー（負荷）は設定を変更できます。',
      '1,000m終了したら挙手し、ジャッジ確認後にランニングへ進む。',
      'ミスの1度目は注意、2度目以降は15秒ペナルティ。'
    ]
  },
  'sled-push': {
    title: '02 Sled Push',
    subtitle: 'スレッドプッシュ',
    image: 'assets/rules/pop/sled-push.png',
    pop: 'assets/rules/pop/sled-push.png',
    page: 2,
    pdf: 'assets/rules/events/02-sled-push.pdf',
    specs: [
      ['距離', '50m'],
      ['女性', '102kg'],
      ['男性', '152kg'],
      ['WOMEN PRO', '152kg'],
      ['MEN PRO', '202kg']
    ],
    rules: [
      '重量はスレッド本体重量（50kg）を含みます。',
      '指定されたレーンを使用し、12.5mを2往復して合計50m行う。',
      '折り返し時はスレッド全体がレーン端を完全に超えてから方向転換する。',
      'レーンを分ける白線にスレッドが触れないように進める。'
    ]
  },
  'sled-pull': {
    title: '03 Sled Pull',
    subtitle: 'スレッドプル',
    image: 'assets/rules/pop/sled-pull.png',
    pop: 'assets/rules/pop/sled-pull.png',
    page: 3,
    pdf: 'assets/rules/events/03-sled-pull.pdf',
    specs: [
      ['距離', '50m'],
      ['女性', '78kg'],
      ['男性', '103kg'],
      ['WOMEN PRO', '103kg'],
      ['MEN PRO', '153kg']
    ],
    rules: [
      '重量はスレッド本体重量（50kg）を含みます。',
      '指定されたレーンを使用し、12.5mを2往復して合計50m行う。',
      '動作中は立った状態を維持し、レーサーボックス内で行う。',
      'ロープも自分のレーン内に収める。'
    ]
  },
  'burpee': {
    title: '04 Burpee Broad Jump',
    subtitle: 'バーピーブロードジャンプ',
    image: 'assets/rules/pop/burpee.png',
    pop: 'assets/rules/pop/burpee.png',
    page: 4,
    pdf: 'assets/rules/events/04-burpee-broad-jump.pdf',
    specs: [
      ['距離', '80m'],
      ['女性', '---'],
      ['男性', '---'],
      ['WOMEN PRO', '---'],
      ['MEN PRO', '---']
    ],
    rules: [
      '最初のバーピーは胸が地面についた状態で開始する。',
      'ブロードジャンプの着地は常に両足を平行にする。',
      '2回目以降のバーピー開始時、両手はつま先から30cm以内に置く。',
      'ボトムポジションでは胸を地面につける。'
    ]
  },
  'rowing': {
    title: '05 Rowing',
    subtitle: 'ローイング',
    image: 'assets/rules/pop/rowing.png',
    pop: 'assets/rules/pop/rowing.png',
    page: 5,
    pdf: 'assets/rules/events/05-rowing.pdf',
    specs: [
      ['距離', '1,000m'],
      ['女性', '---'],
      ['男性', '---'],
      ['WOMEN PRO', '---'],
      ['MEN PRO', '---']
    ],
    rules: [
      '競技中は常に足をフットプレートの上に置く。',
      '一度マシンに座ったら、終わるまで降りない。',
      'ダンパー（負荷）は設定を変更できます。',
      '1,000m終了したら挙手し、ジャッジ確認後にランニングへ進む。'
    ]
  },
  'farmers-carry': {
    title: '06 Farmers Carry',
    subtitle: 'ファーマーズキャリー',
    image: 'assets/rules/pop/farmers-carry.png',
    pop: 'assets/rules/pop/farmers-carry.png',
    page: 6,
    pdf: 'assets/rules/events/06-farmers-carry.pdf',
    specs: [
      ['距離', '200m'],
      ['女性', '16kg x2'],
      ['男性', '24kg x2'],
      ['WOMEN PRO', '24kg x2'],
      ['MEN PRO', '32kg x2']
    ],
    rules: [
      'ケトルベルは指定の場所から持ち出し、指定の場所へ戻した時点で終了。',
      '移動中は2つのケトルベルを両腕を伸ばした状態で持つ。',
      '置いて休む場合は必ず身体の両脇に置く。',
      '正しい場所・状態に戻せばペナルティにならない。'
    ]
  },
  'sandbag-lunges': {
    title: '07 Sandbag Lunges',
    subtitle: 'サンドバッグランジ',
    image: 'assets/rules/pop/sandbag-lunges.png',
    pop: 'assets/rules/pop/sandbag-lunges.png',
    page: 7,
    pdf: 'assets/rules/events/07-sandbag-lunges.pdf',
    specs: [
      ['距離', '100m'],
      ['女性', '10kg'],
      ['男性', '20kg'],
      ['WOMEN PRO', '20kg'],
      ['MEN PRO', '30kg']
    ],
    rules: [
      'サンドバッグを指定の場所から持ち出し、指定の場所へ戻した時点で終了。',
      '最初のランジは両足をスタートライン後方に揃えて直立した状態から始める。',
      '後ろ膝は必ず床につける。',
      '休む際はサンドバッグを肩に乗せたまま直立姿勢で休む。'
    ]
  },
  'wall-balls': {
    title: '08 Wall Balls',
    subtitle: 'ウォールボール',
    image: 'assets/rules/pop/wall-balls.png',
    pop: 'assets/rules/pop/wall-balls.png',
    page: 8,
    pdf: 'assets/rules/events/08-wall-balls.pdf',
    specs: [
      ['回数', '100回'],
      ['女性', '4kg（2.70m）'],
      ['男性', '6kg（3.00m）'],
      ['WOMEN PRO', '6kg（2.70m）'],
      ['MEN PRO', '9kg（3.00m）']
    ],
    rules: [
      '直立姿勢でウォールボールを両手で持った姿勢から開始する。',
      'スクワットでしゃがみ、立ち上がりながらボールを投げる。',
      '指定ターゲットに当てるまでが1レップ。',
      'スクワットが浅い場合やターゲットに当たらない場合はカウントされない。'
    ]
  }
};

function openRuleModal(ruleId) {
  const detail = ruleDetails[ruleId];
  if (!detail) return;

  document.getElementById('rule-modal-title').textContent = detail.title;
  document.getElementById('rule-modal-subtitle').textContent = detail.subtitle;

  const specGrid = document.getElementById('rule-spec-grid');
  specGrid.innerHTML = detail.specs.map(([label, value]) => `
    <div class="rule-spec">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join('');

  const rulesList = document.getElementById('rule-modal-rules');
  rulesList.innerHTML = detail.rules.map(rule => `<li>${rule}</li>`).join('');

  const modal = document.getElementById('rule-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeRuleModal() {
  const modal = document.getElementById('rule-modal');
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

const officialStoreOrder = [
  '浜松町東京店',
  '銀座東京店',
  '原宿東京店',
  '原宿ANNEX',
  '東陽町スーパーセンター店',
  '浦安千葉店',
  '千葉ニュータウン店',
  '幕張ベイパークアリーナ店',
  '前橋インター店',
  'さいたまアリーナ店',
  '橿原奈良店'
];

const STORES = [
  {
    id: 'hamamatsucho',
    name: '浜松町東京店',
    area: 'tokyo',
    lat: 35.6571,
    lng: 139.7560,
    access: 'JR浜松町駅 北口より徒歩2分',
    gmapUrl: 'https://maps.google.com/?q=GOLD%27S+GYM+浜松町東京',
    embedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.816415206134!2d139.7586332!3d35.65689449999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188bcc73e93fff%3A0x441f9d8f52747d8e!2z44K044O844Or44OJ44K444OgIOa1nOadvueUuuadseS6rA!5e0!3m2!1sja!2sjp!4v1792740887213!5m2!1sja!2sjp"
  },
  {
    id: 'ginza',
    name: '銀座東京店',
    area: 'tokyo',
    lat: 35.6747,
    lng: 139.7668,
    access: '銀座一丁目駅 徒歩1分／有楽町駅 徒歩4分',
    gmapUrl: 'https://www.google.com/maps/search/?api=1&query=ゴールドジム銀座東京',
    embedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1620.55811122386!2d139.76594194999998!3d35.67414015!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188be4ead83ce3%3A0xaf620a93e625be54!2z44K044O844Or44OJ44K444OgIOmKgOW6p-adseS6rA!5e0!3m2!1sja!2sjp!4v1792741145166!5m2!1sja!2sjp"
  },
  {
    id: 'harajuku-tokyo',
    name: '原宿東京店',
    area: 'tokyo',
    lat: 35.6686494,
    lng: 139.7044101,
    access: '明治神宮前駅 徒歩1分／JR原宿駅 徒歩3分',
    gmapUrl: 'https://www.google.com/maps/search/?api=1&query=ゴールドジム原宿東京',
    embedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.332050753165!2d139.70768655!3d35.66882510000001!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188ca4fad50391%3A0x5a7ff931530f3c36!2z44K044O844Or44OJ44K444Og5Y6f5a6_5p2x5Lqs!5e0!3m2!1sja!2sjp!4v1792741150205!5m2!1sja!2sjp"
  },
  {
    id: 'harajuku-annex',
    name: '原宿ANNEX',
    area: 'tokyo',
    lat: 35.6706619,
    lng: 139.706727,
    access: '明治神宮前駅・JR原宿駅より徒歩5分',
    gmapUrl: 'https://www.google.com/maps/place/ゴールドジム原宿ANNEX/@35.6706619,139.706727,17z',
    embedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.2574669453143!2d139.706727!3d35.67066189999999!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188ca359204d67%3A0xeef9655544633332!2z44K044O844Or44OJ44K444Og5Y6f5a6_QU5ORVg!5e0!3m2!1sja!2sjp!4v1792741153975!5m2!1sja!2sjp"
  },
  {
    id: 'toyocho',
    name: '東陽町スーパーセンター店',
    area: 'tokyo',
    lat: 35.6693,
    lng: 139.8174,
    access: '東京メトロ東西線 東陽町駅',
    gmapUrl: 'https://maps.google.com/?q=GOLD%27S+GYM+東陽町+東京都江東区',
    embedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.443173148025!2d139.8163314!3d35.6660883!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188854f37b28ef%3A0xe6487f3370ebaed!2z44K044O844Or44OJ44K444OgIOadsemZveeUuuOCueODvOODkeODvOOCu-ODs-OCv-ODvA!5e0!3m2!1sja!2sjp!4v1792741157834!5m2!1sja!2sjp"
  },
  {
    id: 'urayasu',
    name: '浦安千葉店',
    area: 'kanto',
    lat: 35.6657,
    lng: 139.8930,
    access: '東京メトロ東西線 浦安駅 徒歩1分',
    gmapUrl: 'https://maps.google.com/?q=GOLD%27S+GYM+浦安+千葉県浦安市',
    embedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3241.4471115070214!2d139.8938149!3d35.66599130000001!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188781b28a57a7%3A0x6dbf8b000d1eb568!2z44K044O844Or44OJ44K444OgIOa1puWuieWNg-iRiQ!5e0!3m2!1sja!2sjp!4v1792741161632!5m2!1sja!2sjp"
  },
  {
    id: 'makuhari',
    name: '幕張ベイパークアリーナ店',
    area: 'kanto',
    lat: 35.6497,
    lng: 140.0417,
    access: 'JR京葉線 海浜幕張駅 北口 徒歩13分',
    gmapUrl: 'https://maps.google.com/?q=GOLD%27S+GYM+幕張ベイパークアリーナ',
    embedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3242.251101346973!2d140.0498385!3d35.6461846!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x602283f7b1a10e5d%3A0x2de05bff7b9a1b83!2z44K044O844Or44OJ44K444OgIOW5leW8teODmeOCpOODkeODvOOCr-OCouODquODvOODiuW6lw!5e0!3m2!1sja!2sjp!4v1792741169215!5m2!1sja!2sjp"
  },
  {
    id: 'chiba',
    name: '千葉ニュータウン店',
    area: 'kanto',
    lat: 35.8005,
    lng: 140.1144,
    access: '北総線 千葉ニュータウン中央駅 徒歩1分',
    gmapUrl: 'https://maps.google.com/?q=GOLD%27S+GYM+千葉ニュータウン+千葉県印西市',
    embedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3236.0462371405865!2d140.11714220000002!3d35.7987982!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60227dd3f185f6df%3A0x2f512258e11d9d44!2z44K044O844Or44OJ44K444OgIOWNg-iRieODi-ODpeODvOOCv-OCpuODsw!5e0!3m2!1sja!2sjp!4v1792741165429!5m2!1sja!2sjp"
  },
  {
    id: 'saitama',
    name: 'さいたまアリーナ店',
    area: 'kanto',
    lat: 35.8948,
    lng: 139.6315,
    access: 'さいたま新都心駅より徒歩3分、北与野駅より徒歩5分',
    gmapUrl: 'https://maps.google.com/?q=GOLD%27S+GYM+さいたまスーパーアリーナ',
    embedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3232.1461734519116!2d139.631707!3d35.8944355!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6018c10ced0c1137%3A0x92b02b6cda0533ce!2z44K044O844Or44OJ44K444OgIOOBleOBhOOBn-OBvuOCueODvOODkeODvOOCouODquODvOODig!5e0!3m2!1sja!2sjp!4v1792741176834!5m2!1sja!2sjp"
  },
  {
    id: 'maebashi',
    name: '前橋インター店',
    area: 'kanto',
    lat: 36.3816,
    lng: 139.0220,
    access: '新前橋駅より徒歩20分・車5分',
    gmapUrl: 'https://maps.google.com/?q=GOLD%27S+GYM+前橋インター+群馬県高崎市中尾町44',
    embedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3212.4266104757144!2d139.0338974!3d36.374665300000004!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x601ef30c20c7e241%3A0x121c4a384ef8333b!2z44K044O844Or44OJ44K444Og5YmN5qmL44Kk44Oz44K_44O8!5e0!3m2!1sja!2sjp!4v1792741173012!5m2!1sja!2sjp"
  },
  {
    id: 'kashihara',
    name: '橿原奈良店',
    area: 'kansai',
    lat: 34.5293036,
    lng: 135.7965698,
    access: '近鉄京都線 新ノ口駅より徒歩約7分',
    gmapUrl: 'https://maps.google.com/?q=GOLD%27S+GYM+橿原奈良+奈良県橿原市十市町1222-1',
    embedUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3286.956154764606!2d135.79658089999998!3d34.529338800000005!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60013381cb9a2ef5%3A0x903e9043547e0ddf!2z44K044O844Or44OJ44K444Og5qm_5Y6f5aWI6Imv!5e0!3m2!1sja!2sjp!4v1792741180759!5m2!1sja!2sjp"
  }
];

let mapArea = 'tokyo';
let selectedMapStoreId = 'hamamatsucho';
let mapReady = false;

function getAreaStores(area) {
  return STORES
    .filter(store => store.area === area)
    .sort((a, b) => officialStoreOrder.indexOf(a.name) - officialStoreOrder.indexOf(b.name));
}

function renderMapStoreButtons(area) {
  const holder = document.getElementById('map-store-buttons');
  if (!holder) return;
  holder.innerHTML = getAreaStores(area).map(store => (
    `<button type="button" class="map-store-button${store.id === selectedMapStoreId ? ' active' : ''}" data-store-id="${store.id}" aria-pressed="${store.id === selectedMapStoreId}">${store.name}</button>`
  )).join('');
}

function updateStoreMap() {
  const store = STORES.find(item => item.id === selectedMapStoreId);
  const frame = document.getElementById('hyrox-store-map');
  if (!store || !frame) return;

  frame.title = `${store.name}のGoogleマップ`;
  document.getElementById('map-selected-name').textContent = store.name;
  document.getElementById('map-selected-access').textContent = store.access;
  const link = document.getElementById('map-external-link');
  link.href = store.gmapUrl;
  link.setAttribute('aria-label', `${store.name}をGoogleマップで開く（別タブ）`);

  document.querySelectorAll('.map-area-btn').forEach(button => {
    const selected = button.dataset.mapArea === mapArea;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  renderMapStoreButtons(mapArea);
  if (mapReady && frame.getAttribute('src') !== store.embedUrl) {
    frame.src = store.embedUrl;
  }
}

function setMapArea(area) {
  const stores = getAreaStores(area);
  if (!stores.length) return;
  mapArea = area;
  if (!stores.some(store => store.id === selectedMapStoreId)) {
    selectedMapStoreId = stores[0].id;
  }
  mapReady = true;
  updateStoreMap();
}

function focusStoreMap(storeId) {
  const store = STORES.find(item => item.id === storeId);
  if (!store) return;
  selectedMapStoreId = store.id;
  mapArea = store.area;
  mapReady = true;
  updateStoreMap();
}

function openStoreMap(storeId) {
  focusStoreMap(storeId);
  const section = document.getElementById('access-map');
  if (section) section.scrollIntoView({ behavior: 'smooth' });
}

function setupLazyMap() {
  const section = document.getElementById('access-map');
  if (!section) return;
  updateStoreMap();
  document.querySelectorAll('.map-area-btn').forEach(button => {
    button.addEventListener('click', () => setMapArea(button.dataset.mapArea));
  });
  document.getElementById('map-store-buttons')?.addEventListener('click', event => {
    const button = event.target.closest('.map-store-button');
    if (button) focusStoreMap(button.dataset.storeId);
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        mapReady = true;
        updateStoreMap();
        observer.disconnect();
      }
    }, { rootMargin: '300px 0px' });
    observer.observe(section);
  } else {
    mapReady = true;
    updateStoreMap();
  }
}

function setupStoreFilters() {
  const grid = document.querySelector('.stores-grid');
  const cards = Array.from(document.querySelectorAll('.store-card'));
  const badge = document.getElementById('store-count-badge');
  if (!grid || cards.length === 0) return;

  const applyFilter = (area) => {
    let visibleCount = 0;
    cards.forEach((card) => {
      const isVisible = area === 'all' || card.dataset.area === area;
      card.classList.toggle('is-hidden', !isVisible);
      if (isVisible) visibleCount += 1;
    });
    document.querySelectorAll('.store-filter-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.areaFilter === area);
    });
    if (badge) badge.textContent = area === 'all' ? `全${cards.length}店舗` : `${visibleCount}店舗`;
    grid.scrollTo({ left: 0, behavior: 'smooth' });
    buildStoreDots();
  };

  document.querySelectorAll('.store-filter-btn').forEach(button => {
    button.addEventListener('click', () => applyFilter(button.dataset.areaFilter));
  });

  buildStoreDots();
}

function buildStoreDots() {
  const grid = document.querySelector('.stores-grid');
  const dots = document.getElementById('store-carousel-dots');
  if (!grid || !dots) return;
  const visibleCards = Array.from(grid.querySelectorAll('.store-card:not(.is-hidden)'));
  dots.innerHTML = visibleCards.map((_, index) => (
    `<span class="store-carousel-dot${index === 0 ? ' active' : ''}"></span>`
  )).join('');

  if (!window.matchMedia('(max-width: 768px)').matches) return;
  const dotItems = Array.from(dots.children);
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const index = visibleCards.indexOf(entry.target);
      dotItems.forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === index));
    });
  }, { root: grid, threshold: 0.62 });

  visibleCards.forEach(card => observer.observe(card));
}

function setupEquipmentScrollHint() {
  const wrap = document.getElementById('equipment-table-wrap');
  if (!wrap) return;
  wrap.addEventListener('scroll', () => {
    if (wrap.scrollLeft > 12) wrap.classList.add('has-scrolled');
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
  const orderClasses = [
    'store-order-hamamatsucho',
    'store-order-ginza',
    'store-order-harajuku-tokyo',
    'store-order-harajuku-annex',
    'store-order-toyocho',
    'store-order-urayasu',
    'store-order-chiba',
    'store-order-makuhari',
    'store-order-maebashi',
    'store-order-saitama',
    'store-order-kashihara'
  ];

  document.querySelectorAll('.stores-grid, .map-grid').forEach((container) => {
    orderClasses.forEach((className) => {
      const item = container.querySelector(`.${className}`);
      if (item) container.appendChild(item);
    });
  });

  const tableBody = document.querySelector('.equipment-table tbody');
  if (tableBody) {
    const storeOrder = ['hamamatsucho', 'ginza', 'harajuku-tokyo', 'harajuku-annex', 'toyocho', 'urayasu', 'chiba', 'makuhari', 'maebashi', 'saitama', 'kashihara'];
    storeOrder.forEach((storeId) => {
      const row = tableBody.querySelector(`tr[data-store-id="${storeId}"]`);
      if (row) tableBody.appendChild(row);
    });
  }

  setupLazyMap();
  setupStoreFilters();
  setupEquipmentScrollHint();
});
