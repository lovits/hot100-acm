#include <stdio.h>
#include <stdlib.h>
#include <limits.h>

static int findMin(int* nums, int numsSize)
{
    int lo = 0;
    int hi = numsSize - 1;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;        
        if (nums[mid] < nums[hi]) {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    return nums[lo];
}
