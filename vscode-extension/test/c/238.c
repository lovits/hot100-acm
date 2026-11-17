int* productExceptSelf(int*a,int n,int*r){*r=n;int*out=malloc(n*sizeof(int));int l=1;for(int i=0;i<n;i++){out[i]=l;l*=a[i];}int v=1;for(int i=n-1;i>=0;i--){out[i]*=v;v*=a[i];}return out;}
