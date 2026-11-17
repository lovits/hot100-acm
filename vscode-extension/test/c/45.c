int jump(int*a,int n){int steps=0,end=0,far=0;for(int i=0;i<n-1;i++){if(i+a[i]>far)far=i+a[i];if(i==end){steps++;end=far;}}return steps;}
