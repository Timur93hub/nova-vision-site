import cv2,numpy as np
Y0,Y1,X0,X1=1880,2060,100,820
DOMES=[(203,1996,68,80),(447,2010,64,80),(577,1987,60,74)]
_dome=np.load('dome.npy').astype(np.float32);_pool=np.load('pool.npy').astype(np.float32)
H,W=_dome.shape
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
rng=np.random.default_rng(11)
def smooth_noise(h,w,s):
    n=rng.standard_normal((h,w)).astype(np.float32);n=cv2.GaussianBlur(n,(0,0),s,borderType=cv2.BORDER_WRAP if False else cv2.BORDER_REFLECT)
    return (n-n.mean())/n.std()
NZ=smooth_noise(256,256,3.0);NZ2=smooth_noise(256,256,1.6)
# per-dome param maps
M=np.zeros((H,W),np.float32);Sx=np.zeros((H,W),np.float32);DID=-np.ones((H,W),np.int32)
for i,(cx,by,hw,h) in enumerate(DOMES):
    dx=(xx-(cx-X0))/hw;dy=((by-Y0)-yy)/h
    ins=(dx*dx+dy*dy<1.05)&(dy>-0.08)
    m=np.arctan2(dx,np.clip(1-dy,1e-3,None)) # meridian
    s=np.sqrt(dx*dx+(1-dy)**2)
    M[ins]=m[ins];Sx[ins]=s[ins];DID[ins]=i
domeA=cv2.GaussianBlur(_dome,(0,0),1.0)[...,None]
WMASK=cv2.GaussianBlur(cv2.dilate(np.maximum(_dome,_pool),np.ones((7,7),np.uint8)),(0,0),1.5)
poolA=cv2.GaussianBlur(_pool,(0,0),0.8)[...,None]
def sample(N,u,v):
    return cv2.remap(N,(u%256).astype(np.float32),(v%256).astype(np.float32),cv2.INTER_LINEAR,borderMode=cv2.BORDER_WRAP)
# particles
P=[]
for i,(cx,by,hw,h) in enumerate(DOMES):
    for k in range(40):
        side=rng.choice([-1,1]);P.append(dict(d=i,side=side,fx=rng.uniform(0.55,1.02),per=rng.uniform(0.3,0.6),off=rng.uniform(0,1),
            vx=rng.uniform(15,70),vy=rng.uniform(25,95),r=rng.uniform(0.8,1.6)))
def apply(F,t):
    R=F[Y0:Y1,X0:X1].copy()
    # dome: shimmer displacement + flowing streaks
    ph=DID*1.7
    u=M*40+ph*13; v=Sx*70-t*95+ph*20
    n1=sample(NZ,u,v); n2=sample(NZ2,M*90+ph*7,Sx*120-t*150)
    dxo=0.8*n1;dyo=0.6*sample(NZ,u+50,v+80)
    D=cv2.remap(R,xx+dxo,yy+dyo,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
    stripe=0.75*n1+0.25*n2
    lum=1+0.09*stripe
    D=D*lum[...,None]
    hi=np.clip((stripe-1.1)/0.6,0,1)[...,None]*0.45
    D=D*(1-hi)+np.array([255,250,240],np.float32)*hi
    R=R*(1-domeA)+D*domeA
    # pool ripples
    rip=np.zeros((H,W),np.float32)
    for i,(cx,by,hw,h) in enumerate(DOMES):
        d=np.sqrt(((xx-(cx-X0))/1.0)**2+((yy-(by-Y0))*3.2)**2)
        rip+=np.sin(d*0.16-t*7.0+i)*np.exp(-np.clip(d-hw,0,None)/120)
    pr=cv2.remap(R,xx+rip*1.3,yy+rip*0.8,cv2.INTER_LINEAR,borderMode=cv2.BORDER_REFLECT)
    sp=sample(NZ2,xx*0.9+t*20,yy*2.2-t*14)
    spark=np.clip((sp-1.7)/0.5,0,1)[...,None]*0.75
    pr=pr*(1+0.06*rip[...,None])
    pr=pr*(1-spark)+np.array([255,252,245],np.float32)*spark
    R=R*(1-poolA)+pr*poolA
    # base foam + droplets
    over=np.zeros((H,W),np.float32)
    for i,(cx,by,hw,h) in enumerate(DOMES):
        cxl,byl=cx-X0,by-Y0
        band=np.exp(-((yy-byl+1)/3.2)**2)*(np.abs(xx-cxl)<hw*1.06)
        fz=sample(NZ2,xx*2.5+i*40,yy*3+t*60)
        over=np.maximum(over,band*np.clip(0.35+0.4*fz,0,1))
    for p in P:
        cx,by,hw,h=DOMES[p['d']]
        tau=((t/p['per'])+p['off'])%1*p['per']
        x=cx-X0+p['side']*(hw*p['fx']+p['vx']*tau);y=by-Y0-2-p['vy']*tau+0.5*420*tau*tau
        if y>by-Y0+5: continue
        cv2.circle(over,(int(x*4),int(y*4)),int(p['r']*4),0.9,-1,lineType=cv2.LINE_AA,shift=2)
    over=cv2.GaussianBlur(over,(0,0),0.6)*WMASK
    over=over[...,None]
    R=R*(1-over)+np.array([255,252,248],np.float32)*over
    F[Y0:Y1,X0:X1]=np.clip(R,0,255)
    return F
