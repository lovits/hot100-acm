int lengthOfLIS(int*a,int n){int*t=malloc((n+1)*sizeof(int)),m=0;for(int i=0;i<n;i++){int l=0,r=m;while(l<r){int k=l+(r-l)/2;if(t[k]<a[i])l=k+1;else r=k;}t[l]=a[i];if(l==m)m++;}free(t);return m;}
