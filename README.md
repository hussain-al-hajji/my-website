# موقع حسين الحاجي

الموقع الشخصي لحسين الحاجي ([hussain-al-hajji.com](https://hussain-al-hajji.com)).

هذا المستودع **عام**: فيه الموقع وما يُنشر فقط. الملفات الخاصة (نماذج التصميم، الخطط، النسخ الاحتياطية، الملفات الأصلية) في مستودع خاص منفصل.

## ما فيه
- `src/pages/` صفحات الموقع (Astro، ثابتة بالكامل، عربية من اليمين إلى اليسار).
- `src/data/` كل المحتوى كملفات JSON. التعديل عليها يغيّر الموقع.
- `src/admin/` لوحة التحكم (`/admin`).
- `worker/` خدمة Cloudflare Worker الصغيرة التي تتحقق من الدخول وتودع التعديلات في GitHub.
- `public/` الصور المضغوطة والخطوط والشعار.
- `/card` بطاقة الأعمال الرقمية (رمز QR وبطاقة اتصال vCard تُولَّد من `site.json`).
- `/profile` ورقة A4 تُحوَّل وقت البناء إلى `hussain-al-hajji-profile.pdf` بواسطة `scripts/make-pdf.mjs`، فيتجدد الملف مع كل نشر. إن لم يتوفر متصفح يُكتفى بتحذير، وللإلزام اضبط `REQUIRE_PDF=1`.
- روابط الحملات: `/?for=owners&goal=ai` تحدّد الجمهور والمخرج في الباحث وصفحة الحقائب والتواصل وتضيف جملة ترحيب في الرئيسية. الفئات: students و employees و owners و leaders و trainers. المخرجات: ai و ecom و sales و leadership و career و training. الجمل من لوحة التحكم (الصفحة الرئيسية).
- `.github/workflows/` النشر التلقائي إلى GitHub Pages، وبناء يومي يخفي الأخبار والإعلانات المنتهية.

## التشغيل محلياً
```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # الناتج في dist/، ويولّد الملف التعريفي PDF إن وُجد متصفح Chrome
npm run build:site  # بناء الموقع فقط دون PDF
npm test          # اختبارات الـ Worker
```

## كيف يعمل التحرير
1. تفتح `/admin` وتسجّل الدخول بحساب Google أو Apple.
2. تعدّل أو تضيف خبراً أو برنامجاً أو دورة أو إعلاناً. الصور تُضغط إلى WebP داخل المتصفح.
3. «نشر التغييرات» يرسل الملفات إلى الـ Worker. يتحقق من الرمز ومن أن الحساب في القائمة المسموحة، ثم يودع التعديل في المستودع.
4. يعيد GitHub Actions بناء الموقع وينشره خلال دقيقتين تقريباً.

الـ Worker لا يقبل إلا `src/data/*.json` وصور `public/img/uploads/*.webp`، فلا يستطيع أحد عبره تعديل الكود أو سير العمل.

وبلا ربط الدخول، تعمل اللوحة في **وضع المعاينة**: التعديلات تُحفظ في المتصفح فقط ولا تصل إلى الموقع، ويمكن تنزيلها كملف JSON.

## الإعداد (مرة واحدة)

### 1. النشر على GitHub Pages
1. Settings > Pages > Source: **GitHub Actions**.
2. Custom domain: `hussain-al-hajji.com` (الملف `public/CNAME` موجود).
3. عند مزوّد الدومين: سجلات `A` إلى `185.199.108.153` و`185.199.109.153` و`185.199.110.153` و`185.199.111.153`، وسجل `CNAME` للـ `www` إلى `hussain-al-hajji.github.io`.
4. فعّل Enforce HTTPS بعد أن يصدر الشهادة.
5. الموقع يُبنى من فرع `main`. ادمج فرع العمل فيه عند الجاهزية.

> الاستضافة المجانية على GitHub Pages تتطلب مستودعاً عاماً. لهذا لا تُوضع فيه أسرار ولا ملفات خاصة.

### 1.5 قبل ربط الدومين وبعده
- قبل الربط يُنشر الموقع تلقائياً على `https://hussain-al-hajji.github.io/my-website/` للمعاينة.
- عند ربط الدومين أضف متغيّري GitHub: `SITE_URL` = `https://hussain-al-hajji.com` و`SITE_BASE` = `/`، ثم أعد تشغيل Deploy.

### 2. تسجيل الدخول (Firebase)
1. أنشئ مشروعاً في [Firebase Console](https://console.firebase.google.com) وأضف تطبيق ويب.
2. Authentication > Sign-in method: فعّل **Google**، وفعّل **Apple** (يحتاج حساب Apple Developer: Services ID ومفتاح، ويُضاف نطاق Firebase كـ Return URL).
3. Authentication > Settings > Authorized domains: أضف `hussain-al-hajji.com`.
4. القيم الحالية محفوظة في `src/admin/public-config.json` (عامة، وليست أسراراً). ولتغييرها دون تعديل الكود انسخ إعدادات التطبيق إلى متغيّرات GitHub (Settings > Secrets and variables > Actions > **Variables**): `PUBLIC_FIREBASE_API_KEY` و`PUBLIC_FIREBASE_AUTH_DOMAIN` و`PUBLIC_FIREBASE_PROJECT_ID` و`PUBLIC_FIREBASE_APP_ID`. هذه قيم عامة بطبيعتها وليست أسراراً.

### 3. الـ Worker
1. أنشئ **fine-grained personal access token** في GitHub لمستودع `my-website` فقط، بصلاحية Contents: Read and write.
2. من مجلد `worker/`:
   ```sh
   npx wrangler secret put GITHUB_TOKEN
   npx wrangler secret put ALLOWED_EMAILS   # بريدك، ويمكن عدة عناوين مفصولة بفاصلة
   npx wrangler secret put ALLOWED_UIDS     # اختياري: UID حساب Apple إن كان بريده مخفياً
   ```
   وضع `FIREBASE_PROJECT_ID` في `wrangler.toml` ثم `npx wrangler deploy`.
3. ضع عنوان الـ Worker في متغيّر GitHub: `PUBLIC_API_URL`.
4. بريد Apple المستعار (`@privaterelay.appleid.com`) لا يُقبل بالبريد. سجّل الدخول مرة، ثم خذ UID من Firebase > Authentication > Users وضعه في `ALLOWED_UIDS`.

### 4. نشر الـ Worker تلقائياً (اختياري)
أضف `CLOUDFLARE_API_TOKEN` و`CLOUDFLARE_ACCOUNT_ID` كأسرار، ومتغيّراً `DEPLOY_WORKER=true`.

## قواعد المستودع
- لا أسرار في أي ملف. الأسرار في Cloudflare وGitHub فقط.
- كل رقم معروض يُحسب من `src/data/` أو يُكتب في `src/data/site.json`.
- بلا إيموجي في الواجهة.
