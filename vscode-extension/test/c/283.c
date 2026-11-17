void moveZeroes(int*a,int n){int k=0;for(int i=0;i<n;i++)if(a[i])a[k++]=a[i];while(k<n)a[k++]=0;}
