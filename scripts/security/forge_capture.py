import asyncio, json, sys
sys.path.insert(0,"/tmp/browser/auth")
from life import login, setup_org, new_wf, assess, C, B
from playwright.async_api import async_playwright
async def main():
  async with async_playwright() as p:
    br=await p.chromium.launch(headless=True)
    A=await br.new_context(viewport={"width":1280,"height":1800})
    reqs=[]
    A.on("request", lambda r: reqs.append({"m":r.method,"u":r.url,"h":r.headers,"b":r.post_data}) if "_serverFn" in r.url else None)
    pa=await login(A,C[0]); await setup_org(pa,"QA Org A"); wid=await new_wf(pa,"QA forge A",2000); await assess(pa)
    json.dump({"wid":wid,"reqs":reqs},open("/tmp/browser/forge/cap.json","w"))
    for r in reqs: print(r["m"], r["u"][:160], (r["b"] or "")[:300])
    await br.close()
asyncio.run(main())
