bool searchMatrix(int**a,int n,int*c,int t){if(!n)return false;int i=0,j=c[0]-1;while(i<n&&j>=0){if(a[i][j]==t)return true;if(a[i][j]>t)j--;else i++;}return false;}
