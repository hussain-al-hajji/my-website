# يولّد نسخاً ثابتة الوزن من خط Noto Sans Arabic المتغيّر المستخدم في الموقع (ترخيص OFL).
# المتصفح يضمّن الخطوط المتغيّرة في PDF بصيغة Type3 فيتشوّه النص المنسوخ؛ والخطوط الثابتة تُضمَّن كخطوط حقيقية بخريطة Unicode سليمة.
# التشغيل: python3 scripts/pdf-fonts/build.py   (يحتاج fonttools و brotli)
import os, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
here = os.path.dirname(os.path.abspath(__file__)); src = os.path.join(here, '..', '..', 'src', 'fonts')
for name, tag in (('f0', 'ar'), ('f1', 'lat')):
    for w in (300, 400, 500, 600, 700, 800):
        f = TTFont(os.path.join(src, name + '.woff2'))
        inst = instantiateVariableFont(f, {'wght': w}, inplace=False)
        inst.flavor = 'woff2'
        inst.save(os.path.join(here, f'nsa-{tag}-{w}.woff2'))
