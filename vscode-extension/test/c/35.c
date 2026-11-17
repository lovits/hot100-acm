#include <stdio.h>
#include <stdlib.h>

static int searchInsert(int* nums, int numsSize, int target)
{
    int low = -1;
    int high = numsSize;
    while (low + 1 < high) {
        int mid = low + (high - low) / 2;
        if (target > nums[mid]) {
            low = mid;
        } else {
            high = mid;
        }
    }
    return high;
}
