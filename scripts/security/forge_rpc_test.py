import json, os, copy, urllib.parse, requests, sys
B="http://localhost:8080"; SU=os.environ["SUPABASE_URL"]; PK=os.environ["SUPABASE_PUBLISHABLE_KEY"]; SR=os.environ["SUPABASE_SERVICE_ROLE_KEY"]
C=json.load(open("/tmp/browser/auth/creds.json")); cap=json.load(open("/tmp/browser/forge/cap.json")); WID=cap["wid"]
def fn(name):
  import base64
  for r in cap["reqs"]:
    seg=r["u"].split("/_serverFn/")[1].split("?")[0]
    d=base64.urlsafe_b64decode(seg+"==").decode(errors="ignore")
    if f'"{name}_' in d: return r
  if name=="deleteWorkflow":
    import base64
    t=fn("upsertWorkflow"); seg=base64.urlsafe_b64encode(json.dumps({"file":"/src/lib/workspace.functions.ts?tss-serverfn-split","export":"deleteWorkflow_createServerFn_handler"},separators=(",",":")).encode()).decode().rstrip("=")
    body={"t":{"t":10,"i":0,"p":{"k":["data"],"v":[{"t":10,"i":1,"p":{"k":["id"],"v":[{"t":1,"s":WID}]},"o":0}]},"o":0},"f":63,"m":[]}
    return {"m":"POST","u":"http://localhost:8080/_serverFn/"+seg,"h":t["h"],"b":json.dumps(body)}
  raise KeyError(name)
def tok(u):
  r=requests.post(f"{SU}/auth/v1/token?grant_type=password",headers={"apikey":PK},json={"email":u["email"],"password":u["password"]}); return r.json()["access_token"]
TA,TB=tok(C[0]),tok(C[1])
ADM={"apikey":SR,"Authorization":f"Bearer {SR}"}
def db(q): return requests.get(f"{SU}/rest/v1/{q}",headers=ADM).json()
P=0;F=0
def err(t):
  try: v=json.loads(t)["p"]["v"]; return v[1].get("t")!=2
  except Exception: return True
def check(n,ok,d=""):
  global P,F; P+=ok; F+=(not ok); print(("PASS" if ok else "FAIL"),n,"—",str(d)[:160])
def node_get(o,path):
  for k in path:
    o=o["p"]["v"][o["p"]["k"].index(k)]
  return o
def call(name,token=None,mut=None,extra_headers=None):
  r=fn(name); h={k:v for k,v in r["h"].items() if k.lower()!="authorization"}
  if token: h["authorization"]=f"Bearer {token}"
  if extra_headers: h.update(extra_headers)
  if r["m"]=="GET":
    body=json.loads(urllib.parse.parse_qs(r["u"].split("?",1)[1])["payload"][0]) if "?" in r["u"] else None
  else: body=json.loads(r["b"])
  if mut: mut(body)
  if r["m"]=="GET":
    resp=requests.get(r["u"].split("?")[0]+("?payload="+urllib.parse.quote(json.dumps(body)) if body else ""),headers=h)
  else: resp=requests.post(r["u"],headers=h,data=json.dumps(body))
  return resp.status_code, resp.text
def setstr(path,val):
  def m(b): node_get(b["t"],["data"]+path)["s"]=val
  return m
def snaps(): return db(f"assessment_snapshots?workflow_id=eq.{WID}&select=revision,results->model,results->priority")
base=snaps(); print("baseline snapshots",base)
wfname=db(f"workflows?id=eq.{WID}&select=name,monthly_volume")[0]
# 1 anonymous
for n in ["getWorkspace","getWorkflowDetail","saveAssessment","upsertWorkflow","deleteWorkflow","createOrganization"]:
  s,t=call(n); check(f"anon {n} rejected", err(t) and WID not in t and "QA Org A" not in t, f"{s} {t[:80]}")
s,t=call("getWorkspace",token="garbage.token.value"); check("forged JWT rejected",err(t) and "QA Org A" not in t,s)
s,t=call("getWorkspace",token=TA[:-4]+"AAAA"); check("tampered-signature JWT rejected",err(t) and "QA Org A" not in t,s)
# 2-4 cross user
s,t=call("getWorkspace",token=TB); check("B getWorkspace excludes A data","QA Org A" not in t and WID not in t,s)
s,t=call("getWorkflowDetail",token=TB); check("B getWorkflowDetail(A wf) → null", "QA forge A" not in t and s<500, t[:120])
s,t=call("saveAssessment",token=TB,mut=setstr(["baseRevision"],1) if False else None); check("B saveAssessment on A wf → not_found", "not_found" in t, t[:120])
def rename(b):
  d=node_get(b["t"],["data"]); d["p"]["k"].insert(0,"id"); d["p"]["v"].insert(0,{"t":1,"s":WID})
s,t=call("upsertWorkflow",token=TB,mut=rename); check("B upsertWorkflow(id=A wf) rejected", err(t), t[:120])
s,t=call("deleteWorkflow",token=TB,mut=setstr(["id"],WID)); check("B deleteWorkflow(A wf) rejected", err(t), t[:120])
check("A workflow unchanged after B attempts", db(f"workflows?id=eq.{WID}&select=name,monthly_volume")[0]==wfname)
def orgforge(b):
  d=node_get(b["t"],["data"]); d["p"]["k"].insert(0,"owner_user_id"); d["p"]["v"].insert(0,{"t":1,"s":"00000000-0000-0000-0000-000000000000"})
s,t=call("createOrganization",token=TB,mut=orgforge); check("createOrganization with forged owner_user_id rejected (strict)", err(t), t[:120])
# 5 forged results
def addtop(k,v):
  def m(b):
    d=node_get(b["t"],["data"]); d["p"]["k"].insert(0,k); d["p"]["v"].insert(0,v)
  return m
def addinputs(k,v):
  def m(b):
    d=node_get(b["t"],["data","inputs"]); d["p"]["k"].insert(0,k); d["p"]["v"].insert(0,v)
  return m
cur=len(snaps())
def seq(*ms):
  def m(b):
    for x in ms: x(b)
  return m
rev=lambda n: setstr(["baseRevision"],n)
s,t=call("saveAssessment",token=TA,mut=seq(rev(cur),addtop("model",{"t":1,"s":"bounded_autonomous"})))
check("forged top-level 'model' field rejected", err(t) and len(snaps())==cur, f"{s} {t[:100]}")
s,t=call("saveAssessment",token=TA,mut=seq(rev(cur),addtop("results",{"t":10,"i":99,"p":{"k":["priority"],"v":[{"t":0,"s":99}]},"o":0})))
check("forged 'results' object rejected", err(t) and len(snaps())==cur, f"{s} {t[:100]}")
s,t=call("saveAssessment",token=TA,mut=seq(rev(cur),addinputs("priority",{"t":0,"s":99})))
check("forged inputs.priority rejected", err(t) and len(snaps())==cur, f"{s} {t[:100]}")
s,t=call("saveAssessment",token=TA,mut=seq(rev(cur),addtop("owner_user_id",{"t":1,"s":"00000000-0000-0000-0000-000000000000"})))
check("forged owner_user_id rejected", err(t) and len(snaps())==cur, f"{s} {t[:100]}")
# 7 invalid / contradictory
s,t=call("saveAssessment",token=TA,mut=seq(rev(cur),setstr(["inputs","factors","repetitiveness"],9)))
check("out-of-range factor (9) rejected", err(t) and len(snaps())==cur, f"{s} {t[:100]}")
s,t=call("saveAssessment",token=TA,mut=seq(rev(cur),setstr(["inputs","factors","irreversibility"],4)))
check("contradictory input (read-only + irreversibility 4) → invalid", "invalid" in t and len(snaps())==cur, t[:140])
s,t=call("saveAssessment",token=TA,mut=seq(rev(cur),setstr(["workflowId"],"not-a-uuid")))
check("malformed workflowId rejected", err(t), s)
# 8 concurrency
s,t=call("saveAssessment",token=TA,mut=rev(0)); check("stale baseRevision 0 → conflict", "conflict" in t and len(snaps())==cur, t[:120])
s,t=call("saveAssessment",token=TA,mut=rev(cur)); ok='"ok"' in t and len(snaps())==cur+1
check("legit save at current revision creates exactly one new revision", ok, t[:80])
after=snaps(); check("server-computed result stored (priority not 99)", all(x.get("priority",{}).get("score")!=99 if isinstance(x.get("priority"),dict) else True for x in after), after[-1])
s,t=call("saveAssessment",token=TA,mut=rev(cur)); check("replay of same revision → conflict", "conflict" in t and len(snaps())==cur+1, t[:100])
# 6 immutable history via direct REST as owner
H={"apikey":PK,"Authorization":f"Bearer {TA}","Content-Type":"application/json","Prefer":"return=representation"}
r=requests.patch(f"{SU}/rest/v1/assessment_snapshots?workflow_id=eq.{WID}",headers=H,json={"results":{"model":"bounded_autonomous"}}); check("owner PATCH snapshot denied", r.status_code>=400 or r.json()==[], r.status_code)
r=requests.delete(f"{SU}/rest/v1/assessment_snapshots?workflow_id=eq.{WID}",headers=H); check("owner DELETE snapshot denied", (r.status_code>=400 or r.json()==[]) and len(snaps())==cur+1, r.status_code)
r=requests.post(f"{SU}/rest/v1/assessment_snapshots",headers=H,json={"workflow_id":WID,"owner_user_id":C[0]["id"],"revision":99,"workflow_attributes_version":1,"workflow_attributes":{},"inputs":{},"scoring_version":"x","results":{}}); check("owner direct INSERT snapshot denied", r.status_code>=400, r.status_code)
HB=dict(H,Authorization=f"Bearer {TB}")
r=requests.get(f"{SU}/rest/v1/assessment_snapshots?workflow_id=eq.{WID}",headers=HB); check("B direct REST read of A snapshots → 0 rows", r.json()==[], r.text[:60])
# CSRF
s,t=call("getWorkspace",token=TA,extra_headers={"origin":"https://evil.example","sec-fetch-site":"cross-site"}); check("cross-site serverFn request blocked by CSRF middleware", err(t) and "QA Org A" not in t, s)
s,t=call("getWorkspace",token=TA); check("A getWorkspace still works (control)", "QA Org A" in t, s)
print(f"\n{P} passed, {F} failed")
