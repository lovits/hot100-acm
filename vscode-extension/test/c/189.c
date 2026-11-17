#include <stdio.h>
#include <stdlib.h>

static void reverse(int *nums, int lo, int hi)
{
    while (lo < hi) {
        int tmp = nums[lo];
        nums[lo] = nums[hi];
        nums[hi] = tmp;
        lo++;
        hi--;
    }
}

static void rotate(int* nums, int numsSize, int k)
{
    if (numsSize == 0) return;
    k %= numsSize;
    if (k == 0) {
        return;
    }

    reverse(nums, 0, numsSize - 1 - k);
    reverse(nums, numsSize - k, numsSize - 1);
    reverse(nums, 0, numsSize - 1);
}
