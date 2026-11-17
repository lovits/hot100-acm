int subarraySum(int*a,int n,int k){int r=0;for(int i=0;i<n;i++){int s=0;for(int j=i;j<n;j++){s+=a[j];r+=s==k;}}return r;}
